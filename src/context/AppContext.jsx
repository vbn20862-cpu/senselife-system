import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext(null)

const DATA_VERSION = 8

const INITIAL_DATA = {
  _dataVersion: DATA_VERSION,
  // 案件
  projects: [
    { id: 'PW_sl', name: '恒春建城150週年推廣活動', status: '執行中', budget: 4165000, contractAmount: 5950000, deductionAmount: 1785000, client: '恒春鎮公所', deadline: '2026-12-31', color: '#3b82f6' },
    { id: 'RME_sl', name: '魯凱小米文化特展', status: '企劃中', budget: 686000, contractAmount: 980000, deductionAmount: 294000, client: '屏東縣霧臺鄉公所', deadline: '2026-06-30', color: '#8b5cf6' },
    { id: 'WTM_sl', name: '霧台鄉地方產業行銷', status: '執行中', budget: 1022000, contractAmount: 1460000, deductionAmount: 438000, client: '屏東縣霧臺鄉公所', deadline: '2026-11-30', color: '#f59e0b' },
    { id: 'MJC_sl', name: '瑪家漫城記者會', status: '結案', budget: 35000, contractAmount: 50000, deductionAmount: 15000, client: '瑪家鄉公所', deadline: '2026-02-28', color: '#10b981' },
    { id: 'Admin_sl', name: '行政用', status: '長期', budget: 0, contractAmount: 0, deductionAmount: 0, client: '內部', deadline: '', color: '#6b7280' },
    { id: 'DIR_sl', name: '付則任巷木', status: '結案', budget: 0, contractAmount: 0, deductionAmount: 0, client: '內部', deadline: '', color: '#ef4444' },
  ],
  // 設計任務
  designTasks: [
    { id: 1, title: 'PW_sl 活動主視覺設計', project: 'PW_sl', status: '進行中', assignee: '全體', dueDate: '2026-03-15', note: '' },
    { id: 2, title: 'RME_sl 展覽文宣排版', project: 'RME_sl', status: '待開始', assignee: '全體', dueDate: '2026-04-01', note: '' },
  ],
  // 財務-代墊
  reimbursements: [
    { id: 1, date: '2026-02-04', person: '阿慶', project: 'MJC_sl', amount: 2000, description: '收據(76384110)', status: '待還款', method: '現金', receiptNo: '收據(76384110)' },
    { id: 2, date: '2026-02-23', person: '阿慶', project: 'Admin_sl', amount: 8250, description: '尾牙餐費', status: '待還款', method: '信用卡', receiptNo: '統編：47900256' },
  ],
  // 財務-採購申請
  purchaseRequests: [],
  // 財務-帳目
  expenses: [
    { id: 'slm26-001', date: '2026/1/2',  direction: '支出', project: 'Admin_sl', category: '印刷',    account: '業務推廣費', amount: 5250,    vendor: '建豪',                    method: '',    receiptNo: '',                          note: '' },
    { id: 'slm26-007', date: '2026/1/13', direction: '支出', project: 'PW_sl',    category: '活動執行', account: '業務推廣費', amount: 1863428, vendor: '開誠國際顧問有限公司',    method: '',    receiptNo: '',                          note: '' },
    // ── 出納登錄匯入 ──
    { id: 'slm26-c001', date: '2026/1/2',  direction: '支出', project: 'PW_sl',    category: '應付未付', account: '', amount: 1358428, vendor: '開譜',              method: '轉帳',  receiptNo: 'VT-43384551',                  note: '' },
    { id: 'slm26-c002', date: '2026/1/2',  direction: '支出', project: 'PW_sl',    category: '公司付款', account: '', amount: 250000,  vendor: '小旅行',            method: '轉帳',  receiptNo: 'VT-34101250',                  note: '' },
    { id: 'slm26-c003', date: '2026/1/2',  direction: '支出', project: 'Admin_sl', category: '公司付款', account: '', amount: 111000,  vendor: '小毛攝影',          method: '轉帳',  receiptNo: '',                             note: '收據未收' },
    { id: 'slm26-c004', date: '2026/1/2',  direction: '支出', project: 'PW_sl',    category: '公司付款', account: '', amount: 27930,   vendor: '救護',              method: '轉帳',  receiptNo: 'TT-43754540',                  note: '' },
    { id: 'slm26-c005', date: '2026/1/2',  direction: '支出', project: 'Admin_sl', category: '公司付款', account: '', amount: 73485,   vendor: '愛印王',            method: '轉帳',  receiptNo: '',                             note: '' },
    { id: 'slm26-c006', date: '2026/1/2',  direction: '支出', project: 'Admin_sl', category: '公司付款', account: '', amount: 380000,  vendor: '詠辰',              method: '轉帳',  receiptNo: '',                             note: '代墊' },
    { id: 'slm26-c007', date: '2026/1/2',  direction: '支出', project: 'Admin_sl', category: '公司付款', account: '', amount: 22762,   vendor: '鈺銘',              method: '轉帳',  receiptNo: '',                             note: '' },
    { id: 'slm26-c008', date: '2026/1/5',  direction: '支出', project: 'Admin_sl', category: '代墊',    account: '', amount: 2250,    vendor: '阿雯',              method: '現金',  receiptNo: '統編：36876384',               note: '' },
    { id: 'slm26-c009', date: '2026/1/5',  direction: '支出', project: 'Admin_sl', category: '應付未付', account: '', amount: 164640,  vendor: '阿甯咕劇團',        method: '轉帳',  receiptNo: '阿甯咕劇團收字第NO114112601號', note: '台東校外劇團票卷' },
    { id: 'slm26-c010', date: '2026/1/7',  direction: '支出', project: 'PW_sl',    category: '應付未付', account: '', amount: 500000,  vendor: '風域祭後擴',        method: '轉帳',  receiptNo: 'VT-43384551',                  note: '' },
    { id: 'slm26-c011', date: '2026/1/15', direction: '支出', project: 'RME_sl',   category: '公司付款', account: '', amount: 1194,    vendor: '小米展印刷',        method: '現金',  receiptNo: '收據(09047792)',               note: '' },
    { id: 'slm26-c012', date: '2026/1/10', direction: '支出', project: 'Admin_sl', category: '代墊',    account: '', amount: 516,     vendor: '阿雯',              method: '現金',  receiptNo: '7-11代收證明 NO.22555003',     note: '大寶車牌電腦割字' },
    { id: 'slm26-c013', date: '2026/1/20', direction: '支出', project: 'Admin_sl', category: '代墊',    account: '', amount: 520,     vendor: '阿雯',              method: '現金',  receiptNo: '統編：36876384',               note: '南島婚禮修正成果報告裝訂' },
    { id: 'slm26-c015', date: '2026/1/21', direction: '支出', project: 'Admin_sl', category: '代墊',    account: '', amount: 70,      vendor: '阿雯',              method: '現金',  receiptNo: '郵局購票第000143號',           note: '南島婚禮修正成果報告郵寄' },
    { id: 'slm26-c016', date: '2026/1/22', direction: '支出', project: 'Admin_sl', category: '代墊',    account: '', amount: 1545,    vendor: '阿雯',              method: '現金',  receiptNo: '統編：92261038',               note: '瑪家文健站紙相框' },
    { id: 'slm26-c017', date: '2026/1/31', direction: '支出', project: 'Admin_sl', category: '代墊',    account: '', amount: 528,     vendor: '阿慶',              method: '信用卡', receiptNo: 'WE-57655394',                  note: '佈置木箱' },
    { id: 'slm26-c018a', date: '2026/1/30', direction: '支出', project: 'Admin_sl', category: '代墊',   account: '', amount: 27516,   vendor: '阿慶',              method: '信用卡', receiptNo: 'WE-57606558',                  note: '辦公室書櫃、窗簾' },
    { id: 'slm26-c018b', date: '2026/2/2',  direction: '支出', project: 'Admin_sl', category: '應付未付', account: '', amount: 16359,  vendor: '大武社區',          method: '轉帳',  receiptNo: '稅金補開',                     note: '' },
    { id: 'slm26-c019', date: '2026/1/30', direction: '支出', project: 'MJC_sl',   category: '代墊',    account: '', amount: 2000,    vendor: '阿慶',              method: '現金',  receiptNo: '收據(76384110)',               note: '胚布差價' },
    { id: 'slm26-c020', date: '2026/2/3',  direction: '支出', project: 'MJC_sl',   category: '代墊',    account: '', amount: 870,     vendor: '阿慶',              method: '現金',  receiptNo: '收據(78790472)',               note: '壓克力顏料' },
    { id: 'slm26-c021', date: '2026/2/4',  direction: '支出', project: 'Admin_sl', category: '代墊',    account: '', amount: 979,     vendor: '陳曦',              method: '現金',  receiptNo: 'XC-64824095',                  note: 'CD' },
    { id: 'slm26-c022', date: '2026/2/4',  direction: '支出', project: 'Admin_sl', category: '代墊',    account: '', amount: 7000,    vendor: '阿慶',              method: '轉帳',  receiptNo: '',                             note: '辦公室訂金＋大寶清潔' },
  ],
  // 常用匯款帳戶
  bankAccounts: [
    { id: 1, name: '祖珠·卡查妮蘭', type: 'employee', bank: '台灣銀行', account: '00000000000', note: '薪資' },
    { id: 2, name: '阿雯', type: 'employee', bank: '郵局', account: '00000000000', note: '薪資' },
  ],
  // 人事-排班
  schedules: [],
  attendance: [],
  // 廠商/聯絡人
  contacts: [
    { id: 1, name: '開誠國際顧問有限公司', type: '廠商', phone: '', email: '', project: 'PW_sl', note: '活動執行' },
    { id: 2, name: '屏東縣霧臺鄉公所', type: '業主', phone: '', email: '', project: 'RME_sl', note: '窗口' },
  ],
  // 公司財產
  assets: [
    { id: 1, name: '筆記型電腦', category: '3C', quantity: 3, purchaseDate: '2024-01-01', status: '正常', note: '' },
    { id: 2, name: '相機', category: '攝影器材', quantity: 1, purchaseDate: '2023-06-01', status: '正常', note: '' },
  ],
  assetLoans: [],
  // 應付款項 { id, vendor, amount, invoiceNo, dueDate, project, status, note }
  payables: [],
  // 行事曆事件
  events: [
    { id: 1, title: 'PW_sl 期中報告', date: '2026-03-20', type: '截止日', project: 'PW_sl', note: '' },
    { id: 2, title: '3月薪資發放', date: '2026-03-15', type: '繳款日', project: '', note: '' },
    { id: 3, title: 'RME_sl 展覽開幕', date: '2026-04-10', type: '活動日', project: 'RME_sl', note: '' },
  ],
  // 案件文件 & 會議記錄
  projectDocs: [],
  meetings: [],
  // 員工
  employees: [
    { id: 1, name: '林家慶',      role: '專案經理', email: '', phone: '' },
    { id: 2, name: '陳毓雯',      role: '設計',     email: '', phone: '' },
    { id: 3, name: '祖珠·卡查妮蘭', role: '執行',   email: '', phone: '' },
    { id: 4, name: '陳曦',        role: '執行',     email: '', phone: '' },
    { id: 5, name: '黃宝琳',      role: '行政',     email: '', phone: '' },
    { id: 6, name: '梁庭瑜',      role: '',         email: '', phone: '' },
  ],
  // 打卡記錄
  clockins: [],
  // 薪資設定
  salarySettings: [
    { id: 9001, empId: 1, payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 5500, activityAttendance: 0,    healthInsEmp: 0,   laborInsEmp: 0,   pensionSelf: 0, dependentHealth: 0,   supplementalIns: 0, wireFee: 30, healthInsEmployer: 0,    laborInsEmployer: 0,    pensionEmployer: 0    },
    { id: 9002, empId: 2, payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 8600, activityAttendance: 0,    healthInsEmp: 458, laborInsEmp: 738, pensionSelf: 0, dependentHealth: 458, supplementalIns: 0, wireFee: 30, healthInsEmployer: 1428, laborInsEmployer: 2582, pensionEmployer: 1770 },
    { id: 9003, empId: 3, payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 0,    activityAttendance: 6710, healthInsEmp: 458, laborInsEmp: 738, pensionSelf: 0, dependentHealth: 916, supplementalIns: 0, wireFee: 0,  healthInsEmployer: 1428, laborInsEmployer: 2582, pensionEmployer: 1770 },
    { id: 9004, empId: 4, payType: 'hourly',  baseSalary: 210,   hourlyRate: 210, mealAllowance: 0, fullAttendanceBonus: 0, activityAttendance: 0, healthInsEmp: 458, laborInsEmp: 738, pensionSelf: 0, dependentHealth: 0, supplementalIns: 0, wireFee: 30, healthInsEmployer: 1428, laborInsEmployer: 2582, pensionEmployer: 1770 },
    { id: 9005, empId: 5, payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 0,    activityAttendance: 6710, healthInsEmp: 458, laborInsEmp: 738, pensionSelf: 0, dependentHealth: 916, supplementalIns: 0, wireFee: 0,  healthInsEmployer: 915,  laborInsEmployer: 2582, pensionEmployer: 1770 },
    { id: 9006, empId: 6, payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 0,    activityAttendance: 0,    healthInsEmp: 0,   laborInsEmp: 0,   pensionSelf: 0, dependentHealth: 0,   supplementalIns: 0, wireFee: 0,  healthInsEmployer: 0,    laborInsEmployer: 0,    pensionEmployer: 0    },
  ],
  // 薪資記錄
  payrolls: [
    {
      id: 'payroll_2026_02_excel', month: '2026-02', label: '115年2月',
      generatedAt: '2026-02-28 00:00', generatedBy: '匯入自Excel',
      slips: [
        { empId: 1, empName: '林家慶',      hoursWorked: 168,   payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 5500, activityAttendance: 0,    overtime: 0, advance: 0, grossPay: 35100, healthInsEmp: 0,   laborInsEmp: 0,   pensionSelf: 0, dependentHealth: 0,   wireFee: 30, totalDeductions: 30,   netPay: 35070, healthInsEmployer: 0,    laborInsEmployer: 0,    pensionEmployer: 0,    totalEmployerBurden: 0,    totalEmployerCost: 35100, note: '' },
        { empId: 2, empName: '陳毓雯',      hoursWorked: 168,   payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 8600, activityAttendance: 0,    overtime: 0, advance: 0, grossPay: 38200, healthInsEmp: 458, laborInsEmp: 738, pensionSelf: 0, dependentHealth: 458, wireFee: 30, totalDeductions: 1684, netPay: 36516, healthInsEmployer: 1428, laborInsEmployer: 2582, pensionEmployer: 1770, totalEmployerBurden: 5780, totalEmployerCost: 43980, note: '' },
        { empId: 3, empName: '祖珠·卡查妮蘭', hoursWorked: 113.5, payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 0,    activityAttendance: 6710, overtime: 0, advance: 0, grossPay: 36310, healthInsEmp: 458, laborInsEmp: 738, pensionSelf: 0, dependentHealth: 916, wireFee: 0,  totalDeductions: 2112, netPay: 34198, healthInsEmployer: 1428, laborInsEmployer: 2582, pensionEmployer: 1770, totalEmployerBurden: 5780, totalEmployerCost: 42090, note: '應上時數：112小時 / 列入薪資：113.5小時 / 轉補休：11小時' },
        { empId: 4, empName: '陳曦',        hoursWorked: 52,    payType: 'hourly',  baseSalary: 10920, mealAllowance: 0, fullAttendanceBonus: 0,    activityAttendance: 0,    overtime: 0, advance: 0, grossPay: 10920, healthInsEmp: 458, laborInsEmp: 738, pensionSelf: 0, dependentHealth: 0,   wireFee: 30, totalDeductions: 1226, netPay: 9694,  healthInsEmployer: 1428, laborInsEmployer: 2582, pensionEmployer: 1770, totalEmployerBurden: 5780, totalEmployerCost: 16700, note: '時薪210×52小時' },
        { empId: 5, empName: '黃宝琳',      hoursWorked: 0,     payType: 'monthly', baseSalary: 29600, mealAllowance: 0, fullAttendanceBonus: 0,    activityAttendance: 6710, overtime: 0, advance: 0, grossPay: 36310, healthInsEmp: 458, laborInsEmp: 738, pensionSelf: 0, dependentHealth: 916, wireFee: 0,  totalDeductions: 2112, netPay: 34198, healthInsEmployer: 915,  laborInsEmployer: 2582, pensionEmployer: 1770, totalEmployerBurden: 5267, totalEmployerCost: 41577, note: '' },
      ],
    },
  ],
  // 請假申請
  leaveRequests: [],
  // 合約
  contracts: [],
  // 公告
  announcements: [],
  // 文件庫
  documents: [],
  // 案件工項 { id, projectId, title, assignee, status, dueDate, note }
  workItems: [],
  // 今日出勤
  todayAttendance: [],
  // 補休使用紀錄 { id, empId, date, hours, note }
  compLeaveRecords: [],
  // 專案類型（可自訂新增）
  projectTypes: ['展覽', '活動', '教育', '市集', '行銷', '其他'],
  // 待辦
  todos: [
    { id: 1, text: 'PW_sl 請款資料整理', done: false, date: '2026-03-02' },
    { id: 2, text: '匯款給阿慶代墊款', done: false, date: '2026-03-02' },
  ],
  // 操作紀錄
  editLogs: [],
}

// 補流水號：把四個集合中沒有 serialNo 的記錄，按日期排序後依月份補上 SL-YYMM-NNNN
function backfillSerials(collections) {
  const keys = ['reimbursements', 'expenses', 'purchaseRequests', 'payables']
  // 收集所有需要補號的記錄，記錄其來源 key 和 id
  const toAssign = []
  for (const key of keys) {
    for (const rec of (collections[key] || [])) {
      if (!rec.serialNo) {
        const raw = (rec.date || '').replace(/\//g, '-')
        const parts = raw.split('-')
        const normalized = parts.length >= 2
          ? `${parts[0]}-${parts[1].padStart(2, '0')}-${(parts[2] || '01').padStart(2, '0')}`
          : '9999-99-99'
        toAssign.push({ key, id: rec.id, date: normalized })
      }
    }
  }
  // 按日期排序後逐月計數
  toAssign.sort((a, b) => a.date.localeCompare(b.date))
  const counters = {}
  const map = {}
  for (const item of toAssign) {
    const yymm = item.date.slice(2, 4) + item.date.slice(5, 7)
    counters[yymm] = (counters[yymm] || 0) + 1
    map[`${item.key}|${item.id}`] = `SL-${yymm}-${String(counters[yymm]).padStart(4, '0')}`
  }
  // 套用
  const result = {}
  for (const key of keys) {
    result[key] = (collections[key] || []).map(rec => {
      const serial = map[`${key}|${rec.id}`]
      return serial ? { ...rec, serialNo: serial } : rec
    })
  }
  return result
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('company_system_data')
    if (saved) {
      const parsed = JSON.parse(saved)
      // 版本升級：強制套用最新的員工、薪資設定；保留既有薪資記錄並補入缺少的月份/帳目
      if ((parsed._dataVersion || 0) < DATA_VERSION) {
        const existingMonths = new Set((parsed.payrolls || []).map(p => p.month))
        const missingPayrolls = INITIAL_DATA.payrolls.filter(p => !existingMonths.has(p.month))
        const existingExpIds = new Set((parsed.expenses || []).map(e => e.id))
        const missingExps = INITIAL_DATA.expenses.filter(e => !existingExpIds.has(e.id))
        const base = {
          ...INITIAL_DATA,
          ...parsed,
          _dataVersion: DATA_VERSION,
          projects: (parsed.projects || INITIAL_DATA.projects).map(p => ({
            contractAmount: 0, deductionAmount: 0, ...p
          })),
          employees: INITIAL_DATA.employees,
          salarySettings: INITIAL_DATA.salarySettings,
          payrolls: [...missingPayrolls, ...(parsed.payrolls || [])],
          expenses: [...missingExps, ...(parsed.expenses || [])],
          compLeaveRecords: parsed.compLeaveRecords || [],
        }
        // 補流水號
        const filled = backfillSerials(base)
        return { ...base, ...filled }
      }
      return { ...INITIAL_DATA, ...parsed }
    }
  } catch (e) { /* ignore */ }
  return INITIAL_DATA
}

export function AppProvider({ children }) {
  const [data, setData] = useState(loadFromStorage)

  useEffect(() => {
    localStorage.setItem('company_system_data', JSON.stringify(data))
  }, [data])

  function update(key, value) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function addItem(key, item) {
    setData(prev => ({ ...prev, [key]: [...prev[key], item] }))
  }

  function updateItem(key, id, updates) {
    setData(prev => ({
      ...prev,
      [key]: prev[key].map(item => item.id === id ? { ...item, ...updates } : item)
    }))
  }

  function deleteItem(key, id) {
    setData(prev => ({ ...prev, [key]: prev[key].filter(item => item.id !== id) }))
  }

  function logEdit({ user, action, entityType, entityName, summary }) {
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      user: user || '未知',
      action: action || '編輯',
      entityType: entityType || '',
      entityName: entityName || '',
      summary: summary || '',
    }
    setData(prev => ({ ...prev, editLogs: [entry, ...(prev.editLogs || [])].slice(0, 500) }))
  }

  function generateSerial() {
    const now = new Date()
    const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `SL-${yymm}-`
    const allSerials = [
      ...(data.reimbursements || []),
      ...(data.expenses || []),
      ...(data.purchaseRequests || []),
      ...(data.payables || []),
    ]
      .map(r => r.serialNo || '')
      .filter(s => s.startsWith(prefix))
      .map(s => parseInt(s.slice(prefix.length)) || 0)
    const maxSeq = allSerials.length > 0 ? Math.max(...allSerials) : 0
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`
  }

  return (
    <AppContext.Provider value={{ data, update, addItem, updateItem, deleteItem, logEdit, generateSerial }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
