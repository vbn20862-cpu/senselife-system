import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { E } from '../styles/earth'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'

const TYPES = [
  {
    key: 'employees',
    label: '員工資料',
    fields: ['name', 'role', 'phone', 'email'],
    example: `name,role,phone,email\n林家慶,專案經理,0912345678,test@example.com\n陳毓雯,設計,,`,
    parse: (row) => ({ id: Date.now() + Math.random(), name: row.name, role: row.role || '', phone: row.phone || '', email: row.email || '' }),
  },
  {
    key: 'projects',
    label: '案件資料',
    fields: ['id', 'name', 'status', 'budget', 'client', 'deadline'],
    example: `id,name,status,budget,client,deadline\nNEW_sl,新案件名稱,執行中,500000,業主名稱,2026-12-31`,
    parse: (row) => ({ id: row.id || `P${Date.now()}`, name: row.name, status: row.status || '執行中', budget: Number(row.budget) || 0, client: row.client || '', deadline: row.deadline || '', color: '#6b7280' }),
  },
  {
    key: 'expenses',
    label: '帳目記錄',
    fields: ['date', 'project', 'category', 'account', 'amount', 'vendor'],
    example: `date,project,category,account,amount,vendor\n2026/1/1,PW_sl,印刷,業務推廣費,5000,廠商名稱`,
    parse: (row) => ({ id: `imp-${Date.now() + Math.random()}`, date: row.date, direction: '支出', project: row.project || '', category: row.category || '', account: row.account || '', amount: Number(row.amount) || 0, vendor: row.vendor || '', receiptNo: '' }),
  },
  {
    key: 'reimbursements',
    label: '代墊申請',
    fields: ['date', 'person', 'project', 'amount', 'description', 'method'],
    example: `date,person,project,amount,description,method\n2026-03-01,阿慶,PW_sl,1500,交通費,現金`,
    parse: (row) => ({ id: Date.now() + Math.random(), date: row.date, person: row.person, project: row.project || '', amount: Number(row.amount) || 0, description: row.description || '', status: '待還款', method: row.method || '現金', receiptNo: '' }),
  },
  {
    key: 'assets',
    label: '公司財產',
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

export default function Import() {
  const { addItem } = useApp()
  const [typeKey, setTypeKey] = useState('employees')
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)

  const currentType = TYPES.find(t => t.key === typeKey)

  function handlePreview() {
    if (!csvText.trim()) return
    const rows = parseCSV(csvText)
    setPreview(rows)
    setResult(null)
  }

  function handleImport() {
    if (!preview?.length) return
    preview.forEach(row => {
      addItem(currentType.key, currentType.parse(row))
    })
    setResult({ count: preview.length, type: currentType.label })
    setPreview(null)
    setCsvText('')
  }

  function loadExample() {
    setCsvText(currentType.example)
    setPreview(null)
    setResult(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>匯入資料</h1>

      {result && (
        <div style={{ ...E.card, backgroundColor: '#edf2ea', border: '1px solid #b8d4b0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle size={18} style={{ color: E.green, flexShrink: 0 }} />
          <span style={{ fontSize: '14px', color: E.greenText, fontWeight: '600' }}>
            成功匯入 {result.count} 筆{result.type}！
          </span>
        </div>
      )}

      <div style={{ ...E.card, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* 類型選擇 */}
        <div>
          <label style={{ fontSize: '12px', color: E.textSecond, fontWeight: '600', display: 'block', marginBottom: '8px' }}>選擇資料類型</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {TYPES.map(t => (
              <button key={t.key} onClick={() => { setTypeKey(t.key); setPreview(null); setResult(null); setCsvText('') }}
                style={{ ...E.tab(typeKey === t.key), fontSize: '13px' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 欄位說明 */}
        <div style={{ backgroundColor: E.sandLight, borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '12px', color: E.textSecond, marginBottom: '4px', fontWeight: '600' }}>必要欄位（CSV 第一行 header）：</div>
          <div style={{ fontSize: '12px', color: E.textPrimary, fontFamily: 'monospace' }}>
            {currentType.fields.join(', ')}
          </div>
        </div>

        {/* CSV 輸入 */}
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

      {/* 預覽表格 */}
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
    </div>
  )
}
