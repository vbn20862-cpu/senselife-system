import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { db } from '../firebase'
import { ref, onValue, set } from 'firebase/database'

const AppContext = createContext(null)

// Firebase 連線狀態 hook
export function useFirebaseConnection() {
  const [connected, setConnected] = useState(true)
  const [lastConnected, setLastConnected] = useState(null)

  useEffect(() => {
    const connRef = ref(db, '.info/connected')
    const unsub = onValue(connRef, (snap) => {
      const isConnected = snap.val() === true
      setConnected(isConnected)
      if (isConnected) setLastConnected(new Date())
    })
    return () => unsub()
  }, [])

  return { connected, lastConnected }
}

const DATA_VERSION = 15

const INITIAL_DATA = {
  _dataVersion: DATA_VERSION,
  // 案件
  projects: [
    { id: 'PW_sl', name: '恒春建城150週年推廣活動', status: '執行中', budget: 4165000, contractAmount: 5950000, deductionAmount: 1785000, client: '恒春鎮公所', deadline: '2026-12-31', color: '#3b82f6' },
    { id: 'RME_sl', name: '魯凱小米文化特展', status: '執行中', budget: 686000, contractAmount: 980000, deductionAmount: 294000, client: '屏東縣霧臺鄉公所', deadline: '2026-06-30', color: '#8b5cf6' },
    { id: 'WTM_sl', name: '霧台鄉地方產業行銷', status: '執行中', budget: 1022000, contractAmount: 1460000, deductionAmount: 438000, client: '屏東縣霧臺鄉公所', deadline: '2026-11-30', color: '#f59e0b' },
    { id: 'MJC_sl', name: '瑪家漫城記者會', status: '結案', budget: 35000, contractAmount: 50000, deductionAmount: 15000, client: '瑪家鄉公所', deadline: '2026-02-28', color: '#10b981' },
    { id: 'Admin_sl', name: '行政用', status: '長期', budget: 0, contractAmount: 0, deductionAmount: 0, client: '內部', deadline: '', color: '#6b7280' },
    { id: 'DIR_sl', name: '付則任巷木', status: '結案', budget: 0, contractAmount: 0, deductionAmount: 0, client: '內部', deadline: '', color: '#ef4444' },
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
  // 應付款項
  payables: [],
  // 行事曆事件
  events: [
    { id: 1, title: 'PW_sl 期中報告', date: '2026-03-20', type: '截止日', project: 'PW_sl', note: '' },
    { id: 2, title: '3月薪資發放', date: '2026-03-15', type: '繳款日', project: '', note: '' },
    { id: 3, title: 'RME_sl 展覽開幕', date: '2026-04-10', type: '活動日', project: 'RME_sl', note: '' },
  ],
  // 員工
  employees: [
    { id: 1, name: '林家慶',      role: '專案經理', email: '', phone: '' },
    { id: 2, name: '陳毓雯',      role: '設計',     email: '', phone: '' },
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
  // 案件工項
  workItems: [
    { id: 'wi-pw-1', projectId: 'PW_sl', title: '視覺設計統籌', assignee: '陳毓雯', status: '進行中', dueDate: '2026-05-30', note: '含主視覺、社群、Banner' },
    { id: 'wi-pw-2', projectId: 'PW_sl', title: '活動場地規劃', assignee: '祖珠·卡查妮蘭', status: '進行中', dueDate: '2026-06-15', note: '場勘+舞台+動線' },
    { id: 'wi-pw-3', projectId: 'PW_sl', title: '廠商發包與聯繫', assignee: '黃宝琳', status: '進行中', dueDate: '2026-06-30', note: '交通、餐飲、舞台' },
    { id: 'wi-rme-1', projectId: 'RME_sl', title: '展覽視覺設計', assignee: '陳毓雯', status: '進行中', dueDate: '2026-04-10', note: '文宣+主視覺+說明牌' },
    { id: 'wi-rme-2', projectId: 'RME_sl', title: '展場佈置與內容', assignee: '祖珠·卡查妮蘭', status: '待開始', dueDate: '2026-04-08', note: '佈置+借展+訪談' },
    { id: 'wi-wtm-1', projectId: 'WTM_sl', title: '品牌與行銷設計', assignee: '陳毓雯', status: '進行中', dueDate: '2026-04-20', note: '行銷素材+包裝' },
    { id: 'wi-wtm-2', projectId: 'WTM_sl', title: '市集執行', assignee: '林家慶', status: '進行中', dueDate: '2026-05-15', note: '場地+攤位+廠商' },
  ],
  // 子任務
  subTasks: [
    { id: 1, workItemId: 'wi-pw-1', parentId: null, title: '活動主視覺設計', category: '設計', status: '進行中', assignee: '陳毓雯', dueDate: '2026-03-15', type: '海報', size: 'A1 直式', purpose: '活動宣傳', quantity: '200張', textContent: '恒春建城150週年紀念活動', note: '', createdBy: '系統', createdAt: '2026-03-01 09:00' },
    { id: 2, workItemId: 'wi-pw-1', parentId: null, title: '社群素材製作', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-03-20', type: '社群貼文', size: '1080×1080px', purpose: 'FB/IG宣傳', quantity: '5組', textContent: '', note: '', createdBy: '系統', createdAt: '2026-03-01 09:00' },
    { id: 3, workItemId: 'wi-pw-1', parentId: null, title: '活動Banner設計', category: '設計', status: '完成', assignee: '陳毓雯', dueDate: '2026-03-05', type: 'Banner', size: '1200×628px', purpose: '官網橫幅', quantity: '2組', textContent: '', note: '已交付', createdBy: '系統', createdAt: '2026-02-20 09:00' },
    { id: 101, workItemId: 'wi-pw-1', parentId: 1, title: '主視覺初稿', category: '設計', status: '完成', assignee: '陳毓雯', dueDate: '2026-03-08', type: '海報', size: 'A1 直式', purpose: '', quantity: '', textContent: '', note: '已提交審核', createdBy: '系統', createdAt: '2026-03-02 09:00' },
    { id: 102, workItemId: 'wi-pw-1', parentId: 1, title: '主視覺二稿修正', category: '設計', status: '進行中', assignee: '陳毓雯', dueDate: '2026-03-12', type: '海報', size: 'A1 直式', purpose: '', quantity: '', textContent: '', note: '業主回饋：字體調整、色調偏暖', createdBy: '系統', createdAt: '2026-03-09 09:00' },
    { id: 103, workItemId: 'wi-pw-1', parentId: 1, title: '主視覺定稿輸出', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-03-15', type: '海報', size: 'A1 直式', purpose: '', quantity: '200張', textContent: '', note: '', createdBy: '系統', createdAt: '2026-03-09 09:00' },
    { id: 4, workItemId: 'wi-pw-2', parentId: null, title: '場地勘查', category: '執行', status: '進行中', assignee: '祖珠·卡查妮蘭', dueDate: '2026-03-18', location: '恒春古城', vendor: '', materials: '捲尺、相機', note: '需確認搭建動線', createdBy: '系統', createdAt: '2026-03-01 09:00' },
    { id: 5, workItemId: 'wi-pw-2', parentId: null, title: '舞台搭建發包', category: '執行', status: '待審核', assignee: '林家慶', dueDate: '2026-03-22', location: '恒春古城西門廣場', vendor: '宏展舞台工程', materials: '舞台、燈光、音響', note: '報價已送審', createdBy: '系統', createdAt: '2026-03-05 10:00' },
    { id: 104, workItemId: 'wi-pw-2', parentId: 4, title: '西門廣場場勘', category: '執行', status: '完成', assignee: '祖珠·卡查妮蘭', dueDate: '2026-03-10', location: '恒春古城西門', vendor: '', materials: '捲尺、相機', note: '已完成丈量與拍照', createdBy: '系統', createdAt: '2026-03-02 09:00' },
    { id: 105, workItemId: 'wi-pw-2', parentId: 4, title: '東門廣場場勘', category: '執行', status: '進行中', assignee: '祖珠·卡查妮蘭', dueDate: '2026-03-16', location: '恒春古城東門', vendor: '', materials: '捲尺、相機', note: '預計3/16前往', createdBy: '系統', createdAt: '2026-03-10 09:00' },
    { id: 106, workItemId: 'wi-pw-2', parentId: 4, title: '場勘報告彙整', category: '執行', status: '待開始', assignee: '祖珠·卡查妮蘭', dueDate: '2026-03-18', location: '', vendor: '', materials: '', note: '含平面圖、動線建議', createdBy: '系統', createdAt: '2026-03-10 09:00' },
    { id: 107, workItemId: 'wi-pw-2', parentId: 5, title: '廠商報價比較', category: '執行', status: '完成', assignee: '林家慶', dueDate: '2026-03-12', location: '', vendor: '', materials: '', note: '已取得三家報價', createdBy: '系統', createdAt: '2026-03-06 09:00' },
    { id: 108, workItemId: 'wi-pw-2', parentId: 5, title: '報價簽核送審', category: '執行', status: '待審核', assignee: '林家慶', dueDate: '2026-03-20', location: '', vendor: '宏展舞台工程', materials: '', note: '選定宏展，報價28萬', createdBy: '系統', createdAt: '2026-03-13 09:00' },
    { id: 109, workItemId: 'wi-pw-2', parentId: 5, title: '簽約與訂金支付', category: '執行', status: '待開始', assignee: '黃宝琳', dueDate: '2026-03-25', location: '', vendor: '宏展舞台工程', materials: '', note: '核准後付30%訂金', createdBy: '系統', createdAt: '2026-03-13 09:00' },
    { id: 6, workItemId: 'wi-pw-3', parentId: null, title: '交通接駁規劃', category: '執行', status: '待開始', assignee: '黃宝琳', dueDate: '2026-04-01', location: '恒春轉運站↔古城', vendor: '屏東客運', materials: '', note: '', createdBy: '系統', createdAt: '2026-03-01 09:00' },
    { id: 7, workItemId: 'wi-pw-3', parentId: null, title: '餐飲廠商聯繫', category: '執行', status: '完成', assignee: '黃宝琳', dueDate: '2026-03-10', location: '', vendor: '恒春在地小吃聯盟', materials: '', note: '已確認15攤', createdBy: '系統', createdAt: '2026-02-25 09:00' },
    { id: 8, workItemId: 'wi-rme-1', parentId: null, title: '展覽文宣排版', category: '設計', status: '進行中', assignee: '陳毓雯', dueDate: '2026-04-01', type: 'DM / 傳單', size: 'A4', purpose: '展覽導覽', quantity: '500份', textContent: '', note: '', createdBy: '系統', createdAt: '2026-03-01 09:00' },
    { id: 201, workItemId: 'wi-rme-1', parentId: 8, title: '文宣內容撰寫', category: '設計', status: '完成', assignee: '祖珠·卡查妮蘭', dueDate: '2026-03-15', type: '', size: '', purpose: '', quantity: '', textContent: '', note: '含中文、魯凱語雙語', createdBy: '系統', createdAt: '2026-03-02 09:00' },
    { id: 202, workItemId: 'wi-rme-1', parentId: 8, title: '文宣初版排版', category: '設計', status: '進行中', assignee: '陳毓雯', dueDate: '2026-03-22', type: 'DM / 傳單', size: 'A4', purpose: '', quantity: '', textContent: '', note: '等文字定稿後排版', createdBy: '系統', createdAt: '2026-03-16 09:00' },
    { id: 203, workItemId: 'wi-rme-1', parentId: 8, title: '校對與修正', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-03-28', type: 'DM / 傳單', size: 'A4', purpose: '', quantity: '', textContent: '', note: '', createdBy: '系統', createdAt: '2026-03-16 09:00' },
    { id: 204, workItemId: 'wi-rme-1', parentId: 8, title: '送印輸出', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-04-01', type: 'DM / 傳單', size: 'A4', purpose: '展覽導覽', quantity: '500份', textContent: '', note: '建豪印刷', createdBy: '系統', createdAt: '2026-03-16 09:00' },
    { id: 9, workItemId: 'wi-rme-1', parentId: null, title: '展場主視覺輸出', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-04-03', type: '識別設計', size: '大圖輸出 240×120cm', purpose: '展場入口', quantity: '1組', textContent: '', note: '', createdBy: '系統', createdAt: '2026-03-10 09:00' },
    { id: 10, workItemId: 'wi-rme-1', parentId: null, title: '展品說明牌設計', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-04-05', type: '其他', size: 'A5 橫式', purpose: '展品標示', quantity: '30張', textContent: '', note: '含中文及魯凱語', createdBy: '系統', createdAt: '2026-03-10 09:00' },
    { id: 11, workItemId: 'wi-rme-2', parentId: null, title: '展場佈置規劃', category: '執行', status: '待開始', assignee: '祖珠·卡查妮蘭', dueDate: '2026-04-05', location: '霧台鄉文物館', vendor: '', materials: '展板、燈具、壓克力架', note: '', createdBy: '系統', createdAt: '2026-03-01 09:00' },
    { id: 12, workItemId: 'wi-rme-2', parentId: null, title: '耆老訪談拍攝', category: '執行', status: '進行中', assignee: '陳曦', dueDate: '2026-03-28', location: '霧台鄉好茶部落', vendor: '小毛攝影', materials: '攝影器材、錄音筆', note: '已完成2位，剩3位', createdBy: '系統', createdAt: '2026-03-05 09:00' },
    { id: 301, workItemId: 'wi-rme-2', parentId: 12, title: '杜花枝耆老訪談', category: '執行', status: '完成', assignee: '陳曦', dueDate: '2026-03-10', location: '好茶部落', vendor: '小毛攝影', materials: '攝影器材、錄音筆', note: '訪談1.5小時，含小米種植經驗', createdBy: '系統', createdAt: '2026-03-06 09:00' },
    { id: 302, workItemId: 'wi-rme-2', parentId: 12, title: '柯玉花耆老訪談', category: '執行', status: '完成', assignee: '陳曦', dueDate: '2026-03-14', location: '好茶部落', vendor: '小毛攝影', materials: '攝影器材、錄音筆', note: '訪談2小時，含祭儀傳統', createdBy: '系統', createdAt: '2026-03-06 09:00' },
    { id: 303, workItemId: 'wi-rme-2', parentId: 12, title: '巴正雄耆老訪談', category: '執行', status: '進行中', assignee: '陳曦', dueDate: '2026-03-20', location: '霧台部落', vendor: '小毛攝影', materials: '攝影器材、錄音筆', note: '已約3/20上午', createdBy: '系統', createdAt: '2026-03-15 09:00' },
    { id: 304, workItemId: 'wi-rme-2', parentId: 12, title: '訪談影像後製剪輯', category: '執行', status: '待開始', assignee: '陳曦', dueDate: '2026-03-26', location: '', vendor: '', materials: '', note: '5位耆老各剪3分鐘短片', createdBy: '系統', createdAt: '2026-03-15 09:00' },
    { id: 13, workItemId: 'wi-rme-2', parentId: null, title: '小米實物借展聯繫', category: '執行', status: '待審核', assignee: '祖珠·卡查妮蘭', dueDate: '2026-03-30', location: '', vendor: '霧台鄉農會', materials: '小米品種標本12組', note: '農會已口頭同意，待正式函文', createdBy: '系統', createdAt: '2026-03-08 09:00' },
    { id: 14, workItemId: 'wi-wtm-1', parentId: null, title: '行銷素材設計', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-04-15', type: 'Banner', size: '1200×628px', purpose: '廣告投放', quantity: '3組', textContent: '', note: '', createdBy: '系統', createdAt: '2026-03-01 09:00' },
    { id: 15, workItemId: 'wi-wtm-1', parentId: null, title: '產品包裝視覺', category: '設計', status: '進行中', assignee: '陳毓雯', dueDate: '2026-04-10', type: '識別設計', size: '依產品規格', purpose: '產品包裝', quantity: '5款', textContent: '', note: '含咖啡、紅藜、小米酒、愛玉、芋頭', createdBy: '系統', createdAt: '2026-03-08 09:00' },
    { id: 401, workItemId: 'wi-wtm-1', parentId: 15, title: '包裝風格提案', category: '設計', status: '完成', assignee: '陳毓雯', dueDate: '2026-03-18', type: '識別設計', size: '', purpose: '', quantity: '', textContent: '', note: '3款風格提案，已選定方案B（部落圖騰風）', createdBy: '系統', createdAt: '2026-03-09 09:00' },
    { id: 402, workItemId: 'wi-wtm-1', parentId: 15, title: '咖啡包裝設計', category: '設計', status: '進行中', assignee: '陳毓雯', dueDate: '2026-03-28', type: '識別設計', size: '半磅袋 18×26cm', purpose: '產品包裝', quantity: '1款', textContent: '', note: '含正面、背面、側標', createdBy: '系統', createdAt: '2026-03-19 09:00' },
    { id: 403, workItemId: 'wi-wtm-1', parentId: 15, title: '紅藜包裝設計', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-04-02', type: '識別設計', size: '300g立袋 15×22cm', purpose: '產品包裝', quantity: '1款', textContent: '', note: '', createdBy: '系統', createdAt: '2026-03-19 09:00' },
    { id: 404, workItemId: 'wi-wtm-1', parentId: 15, title: '小米酒標籤設計', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-04-05', type: '識別設計', size: '瓶標 8×12cm', purpose: '產品包裝', quantity: '1款', textContent: '', note: '需含酒精濃度、容量等法規標示', createdBy: '系統', createdAt: '2026-03-19 09:00' },
    { id: 405, workItemId: 'wi-wtm-1', parentId: 15, title: '愛玉＆芋頭包裝設計', category: '設計', status: '待開始', assignee: '陳毓雯', dueDate: '2026-04-08', type: '識別設計', size: '依產品規格', purpose: '產品包裝', quantity: '2款', textContent: '', note: '', createdBy: '系統', createdAt: '2026-03-19 09:00' },
    { id: 16, workItemId: 'wi-wtm-2', parentId: null, title: '廠商聯繫與報價', category: '執行', status: '進行中', assignee: '黃宝琳', dueDate: '2026-03-25', location: '', vendor: '在地農產合作社', materials: '', note: '需取得三家報價', createdBy: '系統', createdAt: '2026-03-01 09:00' },
    { id: 501, workItemId: 'wi-wtm-2', parentId: 16, title: '農產合作社報價', category: '執行', status: '完成', assignee: '黃宝琳', dueDate: '2026-03-15', location: '', vendor: '霧台鄉農產合作社', materials: '', note: '報價12萬，含場地佈置', createdBy: '系統', createdAt: '2026-03-02 09:00' },
    { id: 502, workItemId: 'wi-wtm-2', parentId: 16, title: '原民會輔導團報價', category: '執行', status: '完成', assignee: '黃宝琳', dueDate: '2026-03-18', location: '', vendor: '原民會地方輔導團', materials: '', note: '報價15萬，含行銷協助', createdBy: '系統', createdAt: '2026-03-02 09:00' },
    { id: 503, workItemId: 'wi-wtm-2', parentId: 16, title: '三地門合作社報價', category: '執行', status: '進行中', assignee: '黃宝琳', dueDate: '2026-03-22', location: '', vendor: '三地門鄉農產合作社', materials: '', note: '已聯繫，等回覆', createdBy: '系統', createdAt: '2026-03-10 09:00' },
    { id: 504, workItemId: 'wi-wtm-2', parentId: 16, title: '報價比較表彙整', category: '執行', status: '待開始', assignee: '黃宝琳', dueDate: '2026-03-25', location: '', vendor: '', materials: '', note: '三家報價到齊後製表', createdBy: '系統', createdAt: '2026-03-10 09:00' },
    { id: 17, workItemId: 'wi-wtm-2', parentId: null, title: '市集場地申請', category: '執行', status: '完成', assignee: '林家慶', dueDate: '2026-03-15', location: '霧台鄉遊客中心前廣場', vendor: '', materials: '', note: '已核准', createdBy: '系統', createdAt: '2026-02-28 09:00' },
    { id: 18, workItemId: 'wi-wtm-2', parentId: null, title: '攤位配置規劃', category: '執行', status: '待開始', assignee: '祖珠·卡查妮蘭', dueDate: '2026-04-20', location: '霧台鄉遊客中心前廣場', vendor: '', materials: '帳篷×20、桌椅×20套', note: '', createdBy: '系統', createdAt: '2026-03-10 09:00' },
  ],
  // 補休使用紀錄（出帳）
  compLeaveRecords: [],
  // 補休進帳（從加班轉、雇主核准）— 含原始費率、到期日，供過期折錢
  compLeaveAccruals: [],
  // 手動新增補休時數（舊制，已停用，保留供資料相容）
  compLeaveManual: [],
  // 活動工作日（YYYY-MM-DD）— 標記為活動日的週末，於勞基法試算引擎當平日計算
  activityWorkDays: [],
  // 專案類型
  projectTypes: ['展覽', '活動', '教育', '市集', '行銷', '其他'],
  // 待辦
  todos: [
    { id: 1, text: 'PW_sl 請款資料整理', done: false, date: '2026-03-02' },
    { id: 2, text: '匯款給阿慶代墊款', done: false, date: '2026-03-02' },
  ],
  // 統編發票
  invoices: [],
  // 近期活動（細部流程 Run Sheet）
  activities: [],
  // 使用者回報
  feedbacks: [],
  // 操作紀錄
  editLogs: [],
}

// 補流水號
function backfillSerials(collections) {
  const keys = ['reimbursements', 'expenses', 'purchaseRequests', 'payables']
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
  toAssign.sort((a, b) => a.date.localeCompare(b.date))
  const counters = {}
  const map = {}
  for (const item of toAssign) {
    const yymm = item.date.slice(2, 4) + item.date.slice(5, 7)
    counters[yymm] = (counters[yymm] || 0) + 1
    map[`${item.key}|${item.id}`] = `SL-${yymm}-${String(counters[yymm]).padStart(4, '0')}`
  }
  const result = {}
  for (const key of keys) {
    result[key] = (collections[key] || []).map(rec => {
      const serial = map[`${key}|${rec.id}`]
      return serial ? { ...rec, serialNo: serial } : rec
    })
  }
  return result
}

function migrateIfNeeded(parsed) {
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
        contractAmount: 0, deductionAmount: 0, ...p,
        status: (p.status === '企劃中' || p.status === '提案中') ? '執行中' : p.status,
      })),
      // 保留線上既有員工與薪資設定（避免版本升級蓋掉 hireDate/電話/離職異動）
      employees: parsed.employees !== undefined ? parsed.employees : INITIAL_DATA.employees,
      salarySettings: parsed.salarySettings !== undefined ? parsed.salarySettings : INITIAL_DATA.salarySettings,
      payrolls: [...missingPayrolls, ...(parsed.payrolls || [])],
      expenses: [...missingExps, ...(parsed.expenses || [])],
      compLeaveRecords: parsed.compLeaveRecords || [],
      compLeaveManual: parsed.compLeaveManual || [],
      // 遷移時保留使用者既有的工項與子任務（若完全沒有才用 INITIAL_DATA）
      workItems: parsed.workItems !== undefined ? parsed.workItems : INITIAL_DATA.workItems,
      subTasks: parsed.subTasks !== undefined ? parsed.subTasks : INITIAL_DATA.subTasks,
      invoices: parsed.invoices || [],
      feedbacks: parsed.feedbacks || [],
      designTasks: undefined,
    }
    const filled = backfillSerials(base)
    return { ...base, ...filled }
  }
  return { ...INITIAL_DATA, ...parsed }
}

// Firebase 存的陣列可能變成物件（含 undefined），需要清理
function cleanFirebaseData(obj) {
  if (obj === null || obj === undefined) return obj
  // 陣列裡的 null 洞（斷網寫入失敗殘留）一律濾掉，避免頁面讀到 undefined 崩潰
  if (Array.isArray(obj)) return obj.filter(x => x !== null && x !== undefined).map(cleanFirebaseData)
  if (typeof obj === 'object') {
    // Firebase 把空陣列存成 null，把含 undefined 的陣列變成帶 null 洞的物件
    // 檢查是否是 Firebase 回傳的「偽陣列」（key 全是數字）
    const keys = Object.keys(obj)
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
      const maxIdx = Math.max(...keys.map(Number))
      const arr = []
      for (let i = 0; i <= maxIdx; i++) {
        if (obj[i] !== undefined && obj[i] !== null) {
          arr.push(cleanFirebaseData(obj[i]))
        }
      }
      return arr
    }
    const cleaned = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) cleaned[k] = cleanFirebaseData(v)
    }
    return cleaned
  }
  return obj
}

export function AppProvider({ children }) {
  const [data, setData] = useState(null)
  const dataRef = useRef(null)
  const [loading, setLoading] = useState(true)

  // 監聽 Firebase 資料
  useEffect(() => {
    const dbRef = ref(db, 'appData')
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const val = snapshot.val()
      if (val) {
        const cleaned = cleanFirebaseData(val)
        const migrated = migrateIfNeeded(cleaned)
        dataRef.current = migrated
        setData(migrated)
      } else {
        // Firebase 沒有資料，嘗試從 localStorage 遷移
        const localData = (() => {
          try {
            const saved = localStorage.getItem('company_system_data')
            if (saved) return migrateIfNeeded(JSON.parse(saved))
          } catch { /* ignore */ }
          return null
        })()
        const initData = localData || INITIAL_DATA
        // 寫入 Firebase
        set(dbRef, initData)
        dataRef.current = initData
        setData(initData)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // 寫入 Firebase — 使用 dataRef 確保每次寫入都基於最新資料
  // 整包寫入（僅供 batchUpdate 跨多 key 時使用）
  const writeToFirebase = useCallback((newData) => {
    dataRef.current = newData
    set(ref(db, 'appData'), newData).catch(err => {
      console.error('Firebase 寫入失敗:', err.code, err.message)
      alert('資料寫入失敗：' + err.message)
    })
  }, [])

  // 只寫有變動的區塊：打一次卡不再整包 1MB 重寫全庫，
  // 大幅降低傳輸中 UTF-8 被切壞（亂碼）與不同使用者互相蓋寫的風險
  const writeKey = useCallback((key, value) => {
    const d = dataRef.current
    if (!d) return
    dataRef.current = { ...d, [key]: value }
    set(ref(db, `appData/${key}`), value).catch(err => {
      console.error('Firebase 寫入失敗:', err.code, err.message)
      alert('資料寫入失敗：' + err.message)
    })
  }, [])

  function update(key, value) {
    writeKey(key, value)
  }

  function addItem(key, item) {
    const d = dataRef.current
    if (!d) return
    const arr = d[key] || []
    // 單筆追加：只寫入新的一格，不重寫整個陣列。
    // 兩台裝置同時新增（例如同時打卡）也不會互相蓋掉對方的紀錄
    dataRef.current = { ...d, [key]: [...arr, item] }
    set(ref(db, `appData/${key}/${arr.length}`), item).catch(err => {
      console.error('Firebase 寫入失敗:', err.code, err.message)
      alert('資料寫入失敗：' + err.message)
    })
  }

  // 原子式批次更新 — 避免連續多次 set() 導致資料被覆蓋
  // updater: (currentData) => newData；只把有變動的 key 分別寫入
  function batchUpdate(updater) {
    const d = dataRef.current
    if (!d) return
    const newData = updater(d)
    if (!newData || newData === d) return
    const changedKeys = Object.keys(newData).filter(k => newData[k] !== d[k])
    if (changedKeys.length === 0) return
    if (changedKeys.length <= 3) {
      for (const k of changedKeys) writeKey(k, newData[k])
    } else {
      writeToFirebase(newData) // 變動太多 key 時整包寫，維持原子性
    }
  }

  function updateItem(key, id, updates) {
    const d = dataRef.current
    if (!d) return
    writeKey(key, (d[key] || []).map(item => item.id === id ? { ...item, ...updates } : item))
  }

  function deleteItem(key, id) {
    const d = dataRef.current
    if (!d) return
    writeKey(key, (d[key] || []).filter(item => item.id !== id))
  }

  function logEdit({ user, action, entityType, entityName, summary }) {
    const d = dataRef.current
    if (!d) return
    const entry = {
      id: Date.now(),
      timestamp: new Date().toLocaleString('sv-SE').slice(0, 16),
      user: user || '未知',
      action: action || '編輯',
      entityType: entityType || '',
      entityName: entityName || '',
      summary: summary || '',
    }
    writeKey('editLogs', [entry, ...(d.editLogs || [])].slice(0, 500))
  }

  function generateSerial() {
    const d = dataRef.current
    if (!d) return 'SL-0000-0001'
    const now = new Date()
    const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `SL-${yymm}-`
    const allSerials = [
      ...(d.reimbursements || []),
      ...(d.expenses || []),
      ...(d.purchaseRequests || []),
      ...(d.payables || []),
    ]
      .map(r => r.serialNo || '')
      .filter(s => s.startsWith(prefix))
      .map(s => parseInt(s.slice(prefix.length)) || 0)
    const maxSeq = allSerials.length > 0 ? Math.max(...allSerials) : 0
    return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`
  }

  return (
    <AppContext.Provider value={{ data, loading, update, addItem, updateItem, deleteItem, logEdit, generateSerial, batchUpdate }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
