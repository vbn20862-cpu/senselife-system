import * as XLSX from 'xlsx'

function downloadWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename)
}

function sheet(rows) {
  return XLSX.utils.json_to_sheet(rows)
}

// 財務資料匯出
export function exportFinance(data) {
  const projectName = p => data.projects.find(x => x.id === p)?.name || p || ''

  const reimburse = data.reimbursements.map(r => ({
    '流水號':   r.serialNo || '',
    '日期':     r.date,
    '人員':     r.person,
    '專案':     projectName(r.project),
    '金額':     r.amount,
    '說明':     r.description,
    '狀態':     r.status,
    '方式':     r.method,
    '收據單號': r.receiptNo,
  }))

  const purchase = data.purchaseRequests.map(p => ({
    '流水號': p.serialNo || '',
    '日期':   p.date,
    '申請人': p.person,
    '說明':   p.description,
    '金額':   p.amount,
    '狀態':   p.status,
    '備註':   p.note || '',
  }))

  const payable = data.payables.map(p => ({
    '流水號':  p.serialNo || '',
    '廠商':    p.vendor,
    '金額':    p.amount,
    '發票號':  p.invoiceNo || '',
    '到期日':  p.dueDate || '',
    '專案':    projectName(p.project),
    '狀態':    p.status,
    '備註':    p.note || '',
  }))

  const expenses = data.expenses.map(e => ({
    '流水號':  e.serialNo || '',
    '日期':    e.date,
    '方向':    e.direction,
    '專案':    projectName(e.project),
    '類別':    e.category,
    '科目':    e.account,
    '金額':    e.amount,
    '廠商':    e.vendor,
    '付款方式': e.method,
    '收據單號': e.receiptNo,
    '備註':    e.note || '',
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet(expenses.length  ? expenses  : [{ '提示': '尚無資料' }]), '帳目')
  XLSX.utils.book_append_sheet(wb, sheet(reimburse.length ? reimburse : [{ '提示': '尚無資料' }]), '代墊申請')
  XLSX.utils.book_append_sheet(wb, sheet(purchase.length  ? purchase  : [{ '提示': '尚無資料' }]), '採購申請')
  XLSX.utils.book_append_sheet(wb, sheet(payable.length   ? payable   : [{ '提示': '尚無資料' }]), '應付款項')

  const today = new Date().toLocaleDateString('sv-SE')
  downloadWorkbook(wb, `財務資料_${today}.xlsx`)
}

// 人事資料匯出
export function exportHR(data) {
  const empName = id => data.employees.find(e => e.id === id || e.id === Number(id))?.name || id || ''

  const employees = data.employees.map(e => ({
    '姓名': e.name,
    '職位': e.role,
    '信箱': e.email,
    '電話': e.phone,
  }))

  // 攤平所有薪資單
  const payrolls = (data.payrolls || []).flatMap(month =>
    (month.slips || []).map(s => ({
      '月份':     month.label || month.month,
      '員工':     s.empName,
      '薪資類型': s.payType === 'hourly' ? '時薪' : '月薪',
      '本薪':     s.baseSalary,
      '全勤獎金': s.fullAttendanceBonus || 0,
      '活動出席': s.activityAttendance || 0,
      '工時':     s.hoursWorked || 0,
      '應領合計': s.grossPay,
      '健保(員工)': s.healthInsEmp || 0,
      '勞保(員工)': s.laborInsEmp || 0,
      '代扣合計': s.totalDeductions,
      '實領':     s.netPay,
      '備註':     s.note || '',
    }))
  )

  const leaves = (data.leaveRequests || []).map(l => ({
    '申請人':  l.person || empName(l.empId),
    '假別':    l.type,
    '開始日':  l.startDate,
    '結束日':  l.endDate,
    '天數':    l.days,
    '狀態':    l.status,
    '原因':    l.reason || '',
  }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet(employees.length ? employees : [{ '提示': '尚無資料' }]), '員工資料')
  XLSX.utils.book_append_sheet(wb, sheet(payrolls.length  ? payrolls  : [{ '提示': '尚無資料' }]), '薪資記錄')
  XLSX.utils.book_append_sheet(wb, sheet(leaves.length    ? leaves    : [{ '提示': '尚無資料' }]), '請假申請')

  const today = new Date().toLocaleDateString('sv-SE')
  downloadWorkbook(wb, `人事資料_${today}.xlsx`)
}
