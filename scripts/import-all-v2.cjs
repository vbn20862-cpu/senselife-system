/**
 * 完整資料匯入腳本 v2
 * - 打卡紀錄（含時間）
 * - 應付未付 → payables
 * - 公司付款 → expenses
 * - 3月排班 → schedules
 * - 新增員工庭瑜
 */
const https = require('https');
const fs = require('fs');

function fetchGviz(id, gid) {
  return new Promise((resolve, reject) => {
    const url = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:json&gid=' + gid;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseGviz(text) {
  const json = text.replace(/^[^{]+/, '').replace(/\);\s*$/, '');
  const data = JSON.parse(json);
  const allCols = data.table.cols;
  // use all cols (some headers may be empty but still have data)
  const colCount = allCols.length;
  const rows = (data.table.rows || []).map(row => {
    return Array.from({ length: colCount }, (_, ci) => {
      const cell = row.c ? row.c[ci] : null;
      if (!cell || cell.v === null || cell.v === undefined) return '';
      const v = cell.v;
      if (typeof v === 'string' && v.startsWith('Date(')) {
        const p = v.match(/Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/);
        if (p) {
          const year = p[1];
          const month = String(Number(p[2]) + 1).padStart(2, '0');
          const day = String(p[3]).padStart(2, '0');
          if (p[4] !== undefined) {
            // datetime: include HH:mm
            const h = String(p[4]).padStart(2, '0');
            const m = String(p[5]).padStart(2, '0');
            return `${year}-${month}-${day} ${h}:${m}`;
          }
          return `${year}-${month}-${day}`;
        }
      }
      return cell.f !== undefined ? String(cell.f) : String(v);
    });
  }).filter(r => r.some(v => v !== ''));

  // col labels
  const cols = allCols.map(c => c.label || '');
  return { cols, rows };
}

function parseAmt(s) {
  if (!s) return 0;
  return Number(String(s).replace(/[^0-9.-]/g, '')) || 0;
}

async function main() {
  console.log('Fetching spreadsheets...');

  const [cashierRaw, clockinRaw, expensesRaw, scheduleRaw] = await Promise.all([
    fetchGviz('1p62ifua-ugRbIvJpjCMhYfDioR9MvQeBTpn9CCVXSUc', '0'),
    fetchGviz('1mTUD7N-rOn_hL1Fs2L9gLE3GHf8MgdNY4jnBG9SrK_A', '84983656'),
    fetchGviz('1fKGzaEbVvzmBZHt5Kr7mwmQDk5G-uOAjx4b2SxWX0rk', '0'),
    fetchGviz('1LOo-JYZFL28_ymoWuAB7WT_gunpqKNi6ox5FfIEJ-lc', '1388784953'),
  ]);

  const cashier = parseGviz(cashierRaw);
  const clockin = parseGviz(clockinRaw);
  const expenses = parseGviz(expensesRaw);
  const schedule = parseGviz(scheduleRaw);

  console.log('Cashier cols:', cashier.cols.slice(0, 12));
  console.log('Cashier rows sample:', cashier.rows.slice(0, 3));
  console.log('Clockin cols:', clockin.cols.slice(0, 6));
  console.log('Clockin rows sample:', clockin.rows.slice(0, 3));
  console.log('Schedule cols sample:', schedule.cols.slice(0, 5), '...');
  console.log('Schedule rows count:', schedule.rows.length);

  // ─────────────────────────────────────────
  // 1. Expenses (帳目，全部48筆)
  // ─────────────────────────────────────────
  const expenseData = expenses.rows.map((r, i) => ({
    id: r[0] || 'exp_' + (i + 1),
    date: r[1] || '',
    direction: r[2] || '支出',
    project: r[3] || '',
    category: r[4] || '',
    account: r[5] || '',
    amount: parseAmt(r[6]),
    vendor: r[7] || '',
    method: r[8] || '',
    receiptNo: r[9] || '',
    note: r[10] || '',
  }));

  // ─────────────────────────────────────────
  // 2. Reimbursements (代墊)
  // ─────────────────────────────────────────
  const reimbursementData = cashier.rows
    .filter(r => r[1] === '代墊')
    .map(r => ({
      id: Number(r[0]) || Date.now(),
      date: r[2] || '',
      person: r[3] || '',
      project: r[5] || '',
      amount: parseAmt(r[7]),
      description: r[8] || r[6] || '代墊款',
      status: r[9] === '是' ? '已還款' : '待還款',
      method: r[4] || '現金',
      receiptNo: r[6] || '',
    }));

  // ─────────────────────────────────────────
  // 3. Payables (應付未付)
  // ─────────────────────────────────────────
  const payableData = cashier.rows
    .filter(r => r[1] === '應付未付')
    .map((r, i) => ({
      id: 90000 + i + 1,
      vendor: r[8] || r[3] || '',   // 備註 (vendor/note), fallback to 付款人
      amount: parseAmt(r[7]),
      invoiceNo: r[6] || '',
      dueDate: r[2] || '',
      project: r[5] || '',
      status: r[9] === '是' ? '已付' : '待付',
      note: '',
    }));

  // ─────────────────────────────────────────
  // 4. 公司付款 → add to expenses
  // ─────────────────────────────────────────
  const companyPayments = cashier.rows
    .filter(r => r[1] === '公司付款')
    .map((r, i) => ({
      id: 'comp_' + (i + 1),
      date: r[2] || '',
      direction: '支出',
      project: r[5] || '',
      category: '公司付款',
      account: r[4] === '轉帳' ? '業務推廣費' : '雜項支出',
      amount: parseAmt(r[7]),
      vendor: r[8] || '',
      method: r[4] || '',
      receiptNo: r[6] || '',
      note: '',
    }));

  // ─────────────────────────────────────────
  // 5. Clockins (含時間)
  // ─────────────────────────────────────────
  // r[0] = "2026-03-09 09:58" (datetime parsed)
  const clockinData = clockin.rows.map((r, i) => {
    const dtStr = r[0] || '';
    const spaceIdx = dtStr.indexOf(' ');
    const datePart = spaceIdx > -1 ? dtStr.slice(0, spaceIdx) : dtStr;
    const timePart = spaceIdx > -1 ? dtStr.slice(spaceIdx + 1) : '';
    return {
      id: i + 1,
      empName: r[1] || '',
      date: datePart,
      time: timePart,
      type: r[2] || '',
      note: r[3] || '',
    };
  }).filter(c => c.empName && c.date);

  // ─────────────────────────────────────────
  // 6. Schedules (March 2026 grid)
  // ─────────────────────────────────────────
  // The gviz "cols" is the sheet's title row, actual data starts at rows[0]
  // rows[0]: date headers ['員工', '03/01', '03/02', ...]
  // rows[1]: weekday labels
  // rows[2..]: employee shift data

  const EMP_MAP = {
    '林家慶': 1,
    '陳毓雯': 2,
    '祖珠・卡查妮籣': 3,
    '祖珠·卡查妮蘭': 3,
    '陳曦': 4,
    '宝琳': 5,
    '庭瑜': 6,
  };

  // Map: D=出勤(8h), V=晚班→出勤(8h), O=休假(0h), H=午班(4h)→上午班, T=活動支援(8h)→出勤
  const SHIFT_MAP = { D: '出勤', V: '出勤', O: '休假', H: '上午班', T: '出勤' };

  function parseScheduleDate(s) {
    if (!s) return null;
    // "2026-03-01" format
    if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
      const p = s.slice(0, 10).split('-');
      return { month: parseInt(p[1]), day: parseInt(p[2]) };
    }
    // "03/01" format
    if (s.match(/^\d{2}\/\d{2}$/)) {
      const p = s.split('/');
      return { month: parseInt(p[0]), day: parseInt(p[1]) };
    }
    return null;
  }

  const scheduleData = [];
  let schedId = 20000;

  // rows[0] = ['員工', '03/01', '03/02', ...] (date header row)
  // rows[1] = weekday labels, skip
  // rows[2..] = employee shift data
  if (schedule.rows.length > 2) {
    const dateHeaderRow = schedule.rows[0]; // ['員工', '03/01', ...]

    for (let ri = 2; ri < schedule.rows.length; ri++) {
      const row = schedule.rows[ri];
      const empName = row[0];
      if (!empName || !EMP_MAP[empName]) continue;
      const empId = EMP_MAP[empName];

      for (let ci = 1; ci < dateHeaderRow.length; ci++) {
        const dateLabel = dateHeaderRow[ci];
        const shiftCode = row[ci];
        if (!dateLabel || !shiftCode) continue;

        const parsed = parseScheduleDate(dateLabel);
        if (!parsed) continue;

        const shift = SHIFT_MAP[shiftCode];
        if (!shift) continue;

        scheduleData.push({
          id: schedId++,
          empId,
          year: 2026,
          month: parsed.month,
          day: parsed.day,
          shift,
        });
      }
    }
  }

  // ─────────────────────────────────────────
  // 7. New employee: 庭瑜
  // ─────────────────────────────────────────
  const newEmployee = { id: 6, name: '庭瑜', role: '兼職', email: '', phone: '' };

  // ─────────────────────────────────────────
  // FINAL OUTPUT
  // ─────────────────────────────────────────
  const allExpenses = [...expenseData, ...companyPayments];

  const result = {
    expenses: allExpenses,
    reimbursements: reimbursementData,
    clockins: clockinData,
    payables: payableData,
    schedules: scheduleData,
    newEmployee,
  };

  fs.writeFileSync(
    'public/import-data.json',
    JSON.stringify(result, null, 2)
  );

  console.log('\n=== Import Summary ===');
  console.log('帳目 (expenses):', expenseData.length, '+ 公司付款', companyPayments.length, '=', allExpenses.length, '筆');
  console.log('代墊申請 (reimbursements):', reimbursementData.length, '筆');
  console.log('打卡紀錄 (clockins):', clockinData.length, '筆 (含時間)');
  console.log('應付款項 (payables):', payableData.length, '筆');
  console.log('排班記錄 (schedules):', scheduleData.length, '筆');
  console.log('新增員工:', newEmployee.name);
  console.log('\nPayables sample:', JSON.stringify(payableData.slice(0, 2), null, 2));
  console.log('Clockins sample:', JSON.stringify(clockinData.slice(0, 3), null, 2));
  console.log('Schedule sample:', JSON.stringify(scheduleData.slice(0, 3), null, 2));
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
