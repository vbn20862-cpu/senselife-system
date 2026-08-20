import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { E, useIsMobile } from '../styles/earth'
import { Upload, CheckCircle, AlertCircle, Download, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

/* ── CSV 匯入類型定義 ── */
const TYPES = [
  {
    key: 'employees', label: '員工資料',
    fields: ['name', 'role', 'phone', 'email'],
    example: `name,role,phone,email\n林家慶,專案經理,0912345678,test@example.com\n陳毓雯,設計,,`,
    parse: (row) => ({ id: Date.now() + Math.random(), name: row.name, role: row.role || '', phone: row.phone || '', email: row.email || '' }),
  },
  {
    key: 'projects', label: '案件資料',
    fields: ['id', 'name', 'status', 'budget', 'client', 'deadline'],
    example: `id,name,status,budget,client,deadline\nNEW_sl,新案件名稱,執行中,500000,業主名稱,2026-12-31`,
    parse: (row) => ({ id: row.id || `P${Date.now()}`, name: row.name, status: row.status || '執行中', budget: Number(row.budget) || 0, client: row.client || '', deadline: row.deadline || '', color: '#6b7280' }),
  },
  {
    key: 'expenses', label: '帳目記錄',
    fields: ['date', 'project', 'category', 'account', 'amount', 'vendor'],
    example: `date,project,category,account,amount,vendor\n2026/1/1,PW_sl,印刷,業務推廣費,5000,廠商名稱`,
    parse: (row) => ({ id: `imp-${Date.now() + Math.random()}`, date: row.date, direction: '支出', project: row.project || '', category: row.category || '', account: row.account || '', amount: Number(row.amount) || 0, vendor: row.vendor || '', receiptNo: '' }),
  },
  {
    key: 'reimbursements', label: '代墊申請',
    fields: ['date', 'person', 'project', 'amount', 'description', 'method'],
    example: `date,person,project,amount,description,method\n2026-03-01,阿慶,PW_sl,1500,交通費,現金`,
    parse: (row) => ({ id: Date.now() + Math.random(), date: row.date, person: row.person, project: row.project || '', amount: Number(row.amount) || 0, description: row.description || '', status: '待還款', method: row.method || '現金', receiptNo: '' }),
  },
  {
    key: 'assets', label: '公司財產',
    fields: ['name', 'category', 'quantity', 'purchaseDate', 'status'],
    example: `name,category,quantity,purchaseDate,status\n投影機,影音器材,1,2024-06-01,正常`,
    parse: (row) => ({ id: Date.now() + Math.random(), name: row.name, category: row.category || '', quantity: Number(row.quantity) || 1, purchaseDate: row.purchaseDate || '', status: row.status || '正常', note: '' }),
  },
]

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] || '' })
    return obj
  })
}

/* ── Excel 範本欄位定義 ── */
const TEMPLATE_SHEETS = {
  '案件': {
    headers: ['id', 'name', 'status', 'budget', 'contractAmount', 'deductionAmount', 'client', 'deadline', 'color'],
    descriptions: ['案件代號（唯一）', '案件名稱', '狀態（執行中/結案/長期）', '預算', '合約金額', '扣除金額', '業主', '截止日期(YYYY-MM-DD)', '顏色代碼(#hex)'],
    examples: [
      ['NEW_sl', '新案件名稱', '執行中', 500000, 700000, 200000, '業主名稱', '2026-12-31', '#3b82f6'],
    ],
  },
  '工項': {
    headers: ['id', 'projectId', 'title', 'assignee', 'status', 'dueDate', 'note'],
    descriptions: ['工項代號（唯一）', '所屬案件代號', '工項名稱', '負責人', '狀態（進行中/待開始/完成）', '截止日期(YYYY-MM-DD)', '備註'],
    examples: [
      ['wi-new-1', 'NEW_sl', '視覺設計統籌', '陳毓雯', '進行中', '2026-06-30', '含主視覺、社群'],
      ['wi-new-2', 'NEW_sl', '活動場地規劃', '祖珠·卡查妮蘭', '待開始', '2026-07-15', '場勘+動線'],
    ],
  },
  '子任務': {
    headers: ['id', 'workItemId', 'parentId', 'title', 'category', 'status', 'assignee', 'dueDate', 'type', 'size', 'purpose', 'quantity', 'location', 'vendor', 'materials', 'note'],
    descriptions: ['任務編號（數字）', '所屬工項代號', '父任務編號（留空=頂層）', '任務名稱', '分類（設計/執行）', '狀態', '負責人', '截止日期', '設計類型', '尺寸', '用途', '數量', '地點（執行類）', '廠商', '材料/器材', '備註'],
    examples: [
      [1001, 'wi-new-1', '', '主視覺設計', '設計', '進行中', '陳毓雯', '2026-04-15', '海報', 'A1 直式', '活動宣傳', '200張', '', '', '', ''],
      [1002, 'wi-new-1', 1001, '主視覺初稿', '設計', '待開始', '陳毓雯', '2026-04-05', '海報', 'A1 直式', '', '', '', '', '', '第一版草稿'],
      [1003, 'wi-new-2', '', '場地勘查', '執行', '待開始', '祖珠·卡查妮蘭', '2026-05-01', '', '', '', '', '活動場地', '', '捲尺、相機', '需確認動線'],
    ],
  },
}

function generateTemplate() {
  const wb = XLSX.utils.book_new()
  for (const [sheetName, config] of Object.entries(TEMPLATE_SHEETS)) {
    const data = [config.headers, config.descriptions, ...config.examples]
    const ws = XLSX.utils.aoa_to_sheet(data)
    // 設定欄寬
    ws['!cols'] = config.headers.map(h => ({ wch: Math.max(h.length * 2, 14) }))
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }
  XLSX.writeFile(wb, '案件匯入範本.xlsx')
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const result = { projects: [], workItems: [], subTasks: [] }

        // 解析案件
        const projSheet = wb.Sheets['案件']
        if (projSheet) {
          const rows = XLSX.utils.sheet_to_json(projSheet, { header: 1 })
          const headers = rows[0] || []
          // 跳過第一行(header)和第二行(說明)，從第三行開始
          for (let i = 2; i < rows.length; i++) {
            const row = rows[i]
            if (!row || !row[0]) continue
            const obj = {}
            headers.forEach((h, idx) => { obj[h] = row[idx] != null ? row[idx] : '' })
            if (obj.id && obj.name) {
              result.projects.push({
                id: String(obj.id).trim(),
                name: String(obj.name).trim(),
                status: obj.status || '執行中',
                budget: Number(obj.budget) || 0,
                contractAmount: Number(obj.contractAmount) || 0,
                deductionAmount: Number(obj.deductionAmount) || 0,
                client: obj.client || '',
                deadline: obj.deadline || '',
                color: obj.color || '#6b7280',
              })
            }
          }
        }

        // 解析工項
        const wiSheet = wb.Sheets['工項']
        if (wiSheet) {
          const rows = XLSX.utils.sheet_to_json(wiSheet, { header: 1 })
          const headers = rows[0] || []
          for (let i = 2; i < rows.length; i++) {
            const row = rows[i]
            if (!row || !row[0]) continue
            const obj = {}
            headers.forEach((h, idx) => { obj[h] = row[idx] != null ? row[idx] : '' })
            if (obj.id && obj.projectId && obj.title) {
              result.workItems.push({
                id: String(obj.id).trim(),
                projectId: String(obj.projectId).trim(),
                title: String(obj.title).trim(),
                assignee: obj.assignee || '',
                status: obj.status || '待開始',
                dueDate: obj.dueDate || '',
                note: obj.note || '',
              })
            }
          }
        }

        // 解析子任務
        const stSheet = wb.Sheets['子任務']
        if (stSheet) {
          const rows = XLSX.utils.sheet_to_json(stSheet, { header: 1 })
          const headers = rows[0] || []
          const now = new Date().toLocaleString('sv-SE').slice(0, 16)
          for (let i = 2; i < rows.length; i++) {
            const row = rows[i]
            if (!row || row[0] == null) continue
            const obj = {}
            headers.forEach((h, idx) => { obj[h] = row[idx] != null ? row[idx] : '' })
            if (obj.id && obj.workItemId && obj.title) {
              result.subTasks.push({
                id: Number(obj.id),
                workItemId: String(obj.workItemId).trim(),
                parentId: obj.parentId ? Number(obj.parentId) : null,
                title: String(obj.title).trim(),
                category: obj.category || '執行',
                status: obj.status || '待開始',
                assignee: obj.assignee || '',
                dueDate: obj.dueDate || '',
                type: obj.type || '',
                size: obj.size || '',
                purpose: obj.purpose || '',
                quantity: obj.quantity ? String(obj.quantity) : '',
                textContent: '',
                location: obj.location || '',
                vendor: obj.vendor || '',
                materials: obj.materials || '',
                note: obj.note || '',
                createdBy: '匯入',
                createdAt: now,
              })
            }
          }
        }

        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/* ── 元件 ── */
export default function Import() {
  const { data, addItem, update } = useApp()
  const mob = useIsMobile()
  const [mode, setMode] = useState('excel') // 'excel' | 'csv'

  // 完整資料備份匯出（含帳號）
  async function exportBackup() {
    let accounts = []
    try {
      const res = await fetch('https://senselifemaker-default-rtdb.firebaseio.com/accounts.json')
      accounts = await res.json() || []
    } catch { /* 帳號抓不到就只備份主資料 */ }
    const backup = { _backupAt: new Date().toLocaleString('sv-SE'), appData: data, accounts }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `深活共構備份_${new Date().toLocaleDateString('sv-SE')}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // CSV 狀態
  const [typeKey, setTypeKey] = useState('employees')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)

  // Excel 狀態
  const [excelPreview, setExcelPreview] = useState(null)
  const [excelResult, setExcelResult] = useState(null)
  const [excelError, setExcelError] = useState(null)
  const fileRef = useRef(null)

  const currentType = TYPES.find(t => t.key === typeKey)

  // ── CSV 處理 ──
  function handlePreview() {
    if (!csvText.trim()) return
    const rows = parseCSV(csvText)
    setPreview(rows)
    setResult(null)
  }
  function handleImport() {
    if (!preview?.length) return
    preview.forEach(row => { addItem(currentType.key, currentType.parse(row)) })
    setResult({ count: preview.length, type: currentType.label })
    setPreview(null)
    setCsvText('')
  }
  function loadExample() {
    setCsvText(currentType.example)
    setPreview(null)
    setResult(null)
  }

  // ── Excel 處理 ──
  async function handleExcelFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setExcelError(null)
    setExcelResult(null)
    try {
      const parsed = await parseExcelFile(file)
      setExcelPreview(parsed)
    } catch (err) {
      setExcelError('檔案解析失敗：' + err.message)
      setExcelPreview(null)
    }
    // 清空 input 讓同檔名能重新上傳
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleExcelImport() {
    if (!excelPreview) return
    const { projects, workItems, subTasks } = excelPreview

    // 取得現有 ID 以避免重複
    const existingProjectIds = new Set((data.projects || []).map(p => p.id))
    const existingWiIds = new Set((data.workItems || []).map(w => w.id))
    const existingStIds = new Set((data.subTasks || []).map(s => s.id))

    let pCount = 0, wCount = 0, sCount = 0

    // 匯入案件
    for (const p of projects) {
      if (!existingProjectIds.has(p.id)) {
        addItem('projects', p)
        pCount++
      }
    }
    // 匯入工項
    for (const w of workItems) {
      if (!existingWiIds.has(w.id)) {
        addItem('workItems', w)
        wCount++
      }
    }
    // 匯入子任務
    for (const s of subTasks) {
      if (!existingStIds.has(s.id)) {
        addItem('subTasks', s)
        sCount++
      }
    }

    setExcelResult({ projects: pCount, workItems: wCount, subTasks: sCount })
    setExcelPreview(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>匯入 / 備份資料</h1>

      {/* 完整資料備份 */}
      <div style={{ ...E.card, display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', backgroundColor: '#f0f5ed', border: '1px solid #cfe0c8' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>🛟 完整資料備份</div>
          <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '3px', lineHeight: 1.5 }}>
            下載一份包含所有資料（員工、打卡、薪資、案件、帳目、帳號…）的 JSON 檔。建議每月備份一次，存到電腦或雲端硬碟。
          </div>
        </div>
        <button onClick={exportBackup} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
          <Download size={15} /> 下載備份檔
        </button>
      </div>

      {/* 模式切換 */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <button onClick={() => setMode('excel')}
          style={{ ...E.tab(mode === 'excel'), fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <FileSpreadsheet size={14} />Excel 批次匯入
        </button>
        <button onClick={() => setMode('csv')}
          style={{ ...E.tab(mode === 'csv'), fontSize: '13px' }}>
          CSV 單筆匯入
        </button>
      </div>

      {/* ════════ Excel 批次匯入 ════════ */}
      {mode === 'excel' && (
        <>
          {excelResult && (
            <div style={{ ...E.card, backgroundColor: '#edf2ea', border: '1px solid #b8d4b0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} style={{ color: E.green, flexShrink: 0 }} />
              <span style={{ fontSize: '14px', color: E.greenText, fontWeight: '600' }}>
                匯入完成！案件 {excelResult.projects} 筆、工項 {excelResult.workItems} 筆、子任務 {excelResult.subTasks} 筆
              </span>
            </div>
          )}

          {excelError && (
            <div style={{ ...E.card, backgroundColor: '#fef2f2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
              <span style={{ fontSize: '14px', color: '#991b1b' }}>{excelError}</span>
            </div>
          )}

          <div style={{ ...E.card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ backgroundColor: E.sandLight, borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', color: E.textPrimary, fontWeight: '600', marginBottom: '6px' }}>使用方式</div>
              <ol style={{ fontSize: '12px', color: E.textSecond, margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
                <li>點「下載 Excel 範本」取得檔案</li>
                <li>用 Excel 或 Google Sheets 打開，填入資料（第一行是欄位名，第二行是說明，<strong>從第三行開始填</strong>）</li>
                <li>三個工作表：<strong>案件</strong>、<strong>工項</strong>、<strong>子任務</strong>，可只填需要的工作表</li>
                <li>填完後存檔（.xlsx 格式），上傳到這裡匯入</li>
              </ol>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={generateTemplate}
                style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Download size={14} />下載 Excel 範本
              </button>

              <label style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <Upload size={14} />上傳填好的 Excel
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleExcelFile}
                  style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          {/* Excel 預覽 */}
          {excelPreview && (
            <div style={{ ...E.card, display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} style={{ color: E.sand }} />
                <span style={{ fontSize: '13px', color: E.textSecond }}>預覽 — 確認後才會匯入（已存在的 ID 會自動跳過）</span>
              </div>

              {/* 案件預覽 */}
              {excelPreview.projects.length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary, marginBottom: '6px' }}>
                    案件（{excelPreview.projects.length} 筆）
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ backgroundColor: E.sandLight }}>
                        <tr>
                          {['代號', '名稱', '狀態', '預算', '業主', '截止日'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: E.textSecond, fontWeight: '600', borderBottom: `1px solid ${E.divider}`, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreview.projects.map((p, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${E.divider}` }}>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{p.id}</td>
                            <td style={{ padding: '6px 10px' }}>{p.name}</td>
                            <td style={{ padding: '6px 10px' }}>{p.status}</td>
                            <td style={{ padding: '6px 10px' }}>{p.budget?.toLocaleString()}</td>
                            <td style={{ padding: '6px 10px' }}>{p.client}</td>
                            <td style={{ padding: '6px 10px' }}>{p.deadline}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 工項預覽 */}
              {excelPreview.workItems.length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary, marginBottom: '6px' }}>
                    工項（{excelPreview.workItems.length} 筆）
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ backgroundColor: E.sandLight }}>
                        <tr>
                          {['代號', '所屬案件', '名稱', '負責人', '狀態', '截止日'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: E.textSecond, fontWeight: '600', borderBottom: `1px solid ${E.divider}`, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreview.workItems.map((w, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${E.divider}` }}>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{w.id}</td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{w.projectId}</td>
                            <td style={{ padding: '6px 10px' }}>{w.title}</td>
                            <td style={{ padding: '6px 10px' }}>{w.assignee}</td>
                            <td style={{ padding: '6px 10px' }}>{w.status}</td>
                            <td style={{ padding: '6px 10px' }}>{w.dueDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 子任務預覽 */}
              {excelPreview.subTasks.length > 0 && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary, marginBottom: '6px' }}>
                    子任務（{excelPreview.subTasks.length} 筆）
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ backgroundColor: E.sandLight }}>
                        <tr>
                          {['編號', '所屬工項', '父任務', '名稱', '分類', '負責人', '狀態'].map(h => (
                            <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: E.textSecond, fontWeight: '600', borderBottom: `1px solid ${E.divider}`, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreview.subTasks.map((s, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${E.divider}` }}>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{s.id}</td>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{s.workItemId}</td>
                            <td style={{ padding: '6px 10px', color: s.parentId ? E.textPrimary : E.textMuted }}>{s.parentId || '—'}</td>
                            <td style={{ padding: '6px 10px' }}>{s.title}</td>
                            <td style={{ padding: '6px 10px' }}>{s.category}</td>
                            <td style={{ padding: '6px 10px' }}>{s.assignee}</td>
                            <td style={{ padding: '6px 10px' }}>{s.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {excelPreview.projects.length === 0 && excelPreview.workItems.length === 0 && excelPreview.subTasks.length === 0 && (
                <div style={{ textAlign: 'center', color: E.textMuted, padding: '16px' }}>
                  未偵測到有效資料，請確認工作表名稱為「案件」「工項」「子任務」，且從第三行開始填寫
                </div>
              )}

              {(excelPreview.projects.length > 0 || excelPreview.workItems.length > 0 || excelPreview.subTasks.length > 0) && (
                <button onClick={handleExcelImport}
                  style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}>
                  <Upload size={14} />確認匯入
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════ CSV 單筆匯入 ════════ */}
      {mode === 'csv' && (
        <>
          {result && (
            <div style={{ ...E.card, backgroundColor: '#edf2ea', border: '1px solid #b8d4b0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={18} style={{ color: E.green, flexShrink: 0 }} />
              <span style={{ fontSize: '14px', color: E.greenText, fontWeight: '600' }}>
                成功匯入 {result.count} 筆{result.type}！
              </span>
            </div>
          )}

          <div style={{ ...E.card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, fontWeight: '600', display: 'block', marginBottom: '8px' }}>選擇資料類型</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {TYPES.map(t => (
                  <button key={t.key} onClick={() => { setTypeKey(t.key); setPreview(null); setResult(null); setCsvText('') }}
                    style={{ ...E.tab(typeKey === t.key), fontSize: '13px' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: E.sandLight, borderRadius: '10px', padding: '12px 14px' }}>
              <div style={{ fontSize: '12px', color: E.textSecond, marginBottom: '4px', fontWeight: '600' }}>必要欄位（CSV 第一行 header）：</div>
              <div style={{ fontSize: '12px', color: E.textPrimary, fontFamily: 'monospace' }}>
                {currentType.fields.join(', ')}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', color: E.textSecond, fontWeight: '600' }}>貼上 CSV 資料</label>
                <button onClick={loadExample} style={{ ...E.btnGhost, fontSize: '11px', padding: '4px 10px' }}>
                  載入範例
                </button>
              </div>
              <textarea
                value={csvText}
                onChange={e => { setCsvText(e.target.value); setPreview(null); setResult(null) }}
                placeholder={`貼上 CSV 格式資料，第一行為欄位名稱\n\n${currentType.example}`}
                rows={7}
                style={{ ...E.input, fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handlePreview} disabled={!csvText.trim()}
                style={{ ...E.btnGhost, opacity: csvText.trim() ? 1 : 0.5 }}>
                預覽資料
              </button>
              {preview && (
                <button onClick={handleImport} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={14} />確認匯入 {preview.length} 筆
                </button>
              )}
            </div>
          </div>

          {preview && preview.length > 0 && (
            <div style={{ ...E.card, padding: 0 }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${E.divider}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} style={{ color: E.sand }} />
                <span style={{ fontSize: '13px', color: E.textSecond }}>預覽 — 共 <strong>{preview.length}</strong> 筆，確認後才會匯入</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead style={{ backgroundColor: E.sandLight }}>
                    <tr>
                      {currentType.fields.map(f => (
                        <th key={f} style={{ padding: '8px 12px', textAlign: 'left', color: E.textSecond, fontWeight: '600', borderBottom: `1px solid ${E.divider}`, whiteSpace: 'nowrap' }}>{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${E.divider}` }}>
                        {currentType.fields.map(f => (
                          <td key={f} style={{ padding: '8px 12px', color: row[f] ? E.textPrimary : E.textMuted }}>
                            {row[f] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview && preview.length === 0 && (
            <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, padding: '24px' }}>
              CSV 解析結果為空，請確認格式是否正確
            </div>
          )}
        </>
      )}
    </div>
  )
}
