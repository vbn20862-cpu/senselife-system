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
  const cols = data.table.cols.map(c => c.label).filter(l => l);
  const rows = (data.table.rows || []).map(row =>
    row.c.slice(0, cols.length).map(cell => {
      if (!cell || cell.v === null || cell.v === undefined) return '';
      if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
        const p = cell.v.match(/Date\((\d+),(\d+),(\d+)/);
        if (p) return p[1] + '/' + String(Number(p[2])+1).padStart(2,'0') + '/' + String(p[3]).padStart(2,'0');
      }
      return cell.f !== undefined ? cell.f : cell.v;
    })
  ).filter(r => r.some(v => v !== ''));
  return { cols, rows };
}

function parseAmt(s) {
  if (!s) return 0;
  return Number(String(s).replace(/[^0-9.-]/g, '')) || 0;
}

async function main() {
  const [cashierRaw, clockinRaw, expensesRaw] = await Promise.all([
    fetchGviz('1p62ifua-ugRbIvJpjCMhYfDioR9MvQeBTpn9CCVXSUc', '0'),
    fetchGviz('1mTUD7N-rOn_hL1Fs2L9gLE3GHf8MgdNY4jnBG9SrK_A', '84983656'),
    fetchGviz('1fKGzaEbVvzmBZHt5Kr7mwmQDk5G-uOAjx4b2SxWX0rk', '0'),
  ]);

  const cashier = parseGviz(cashierRaw);
  const clockin = parseGviz(clockinRaw);
  const expenses = parseGviz(expensesRaw);

  // expenses
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

  // reimbursements (代墊 only from cashier sheet)
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

  // clockins
  const clockinData = clockin.rows.map((r, i) => ({
    id: i + 1,
    empName: r[1] || '',
    date: r[0] || '',
    type: r[2] || '',
    note: r[3] || '',
  }));

  const result = { expenses: expenseData, reimbursements: reimbursementData, clockins: clockinData };
  fs.writeFileSync('public/import-data.json', JSON.stringify(result));
  console.log('Done:', expenseData.length, 'expenses,', reimbursementData.length, 'reimbursements,', clockinData.length, 'clockins');
}

main().catch(console.error);
