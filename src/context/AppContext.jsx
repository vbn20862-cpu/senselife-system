import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext(null)

const INITIAL_DATA = {
  // 案件
  projects: [
    { id: 'PW_sl', name: '恒春建城150週年推廣活動', status: '執行中', budget: 4165000, client: '恒春鎮公所', deadline: '2026-12-31', color: '#3b82f6' },
    { id: 'RME_sl', name: '魯凱小米文化特展', status: '企劃中', budget: 686000, client: '屏東縣霧臺鄉公所', deadline: '2026-06-30', color: '#8b5cf6' },
    { id: 'WTM_sl', name: '霧台鄉地方產業行銷', status: '執行中', budget: 1022000, client: '屏東縣霧臺鄉公所', deadline: '2026-11-30', color: '#f59e0b' },
    { id: 'MJC_sl', name: '瑪家漫城記者會', status: '結案', budget: 35000, client: '瑪家鄉公所', deadline: '2026-02-28', color: '#10b981' },
    { id: 'Admin_sl', name: '行政用', status: '長期', budget: 0, client: '內部', deadline: '', color: '#6b7280' },
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
    { id: 'slm26-001', date: '2026/1/2', direction: '支出', project: 'Admin_sl', category: '印刷', account: '業務推廣費', amount: 5250, vendor: '建豪', receiptNo: '' },
    { id: 'slm26-007', date: '2026/1/13', direction: '支出', project: 'PW_sl', category: '活動執行', account: '業務推廣費', amount: 1863428, vendor: '開誠國際顧問有限公司', receiptNo: '' },
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
    { id: 1, name: '林家慶', role: '專案經理', email: '', phone: '' },
    { id: 2, name: '陳毓雯', role: '設計', email: '', phone: '' },
    { id: 3, name: '祖珠·卡查妮蘭', role: '執行', email: '', phone: '' },
    { id: 4, name: '陳曦', role: '執行', email: '', phone: '' },
    { id: 5, name: '宝琳', role: '行政', email: '', phone: '' },
  ],
  // 打卡記錄 { id, empId, empName, date, time, type }
  // type: '上班' | '下班' | '加班開始' | '加班結束'
  clockins: [],
  // 薪資設定
  salarySettings: [],
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
  // 待辦
  todos: [
    { id: 1, text: 'PW_sl 請款資料整理', done: false, date: '2026-03-02' },
    { id: 2, text: '匯款給阿慶代墊款', done: false, date: '2026-03-02' },
  ],
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('company_system_data')
    if (saved) return JSON.parse(saved)
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

  return (
    <AppContext.Provider value={{ data, update, addItem, updateItem, deleteItem }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
