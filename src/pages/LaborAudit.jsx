import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { computePayroll, hourlyRate, monthlyTotalRegularPay, govtHoursOf } from '../utils/payrollEngine'
import { Scale, AlertTriangle, FileText, ChevronDown, CalendarPlus, X } from 'lucide-react'

const E = {
  card: '#fff8f0',
  border: '#e5d5c0',
  text: '#3e2e1e',
  textMuted: '#8a7a6a',
  textSecond: '#5c4b3a',
  brand: '#c85c28',
  good: '#3a6d31',
  warn: '#c08a30',
  bad: '#c04030',
}

export default function LaborAudit() {
  const { data, update } = useApp()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth() + 1)
  const [empId, setEmpId] = useState(data.employees?.[0]?.id ?? null)
  const [showJson, setShowJson] = useState(false)
  const [newWorkDay, setNewWorkDay] = useState('')

  const emp = data.employees.find(e => e.id === empId)
  const result = useMemo(() => emp ? computePayroll(emp, yr, mo, data) : null, [emp, yr, mo, data])

  const setting = data.salarySettings.find(s => s.empId === empId)
  const govtHrs = govtHoursOf(yr, mo)
  const monthStr = `${yr}-${String(mo).padStart(2, '0')}`
  const activityDays = (data.activityWorkDays || []).filter(d => d.startsWith(monthStr)).sort()

  function addActivityDay() {
    if (!newWorkDay || !/^\d{4}-\d{2}-\d{2}$/.test(newWorkDay)) return
    const current = data.activityWorkDays || []
    if (current.includes(newWorkDay)) { setNewWorkDay(''); return }
    update('activityWorkDays', [...current, newWorkDay].sort())
    setNewWorkDay('')
  }
  function removeActivityDay(date) {
    update('activityWorkDays', (data.activityWorkDays || []).filter(x => x !== date))
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Scale size={22} style={{ color: E.brand }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: E.text, margin: 0 }}>勞基法薪資試算</h1>
        <span style={{ fontSize: 11, color: E.textMuted, marginLeft: 'auto' }}>
          引擎依勞基法第 24/32/36/37/39 條　寧可多給、不可少給
        </span>
      </div>

      {/* 篩選列 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, backgroundColor: E.card, border: `1px solid ${E.border}`, borderRadius: 12, padding: 14 }}>
        <Field label="員工">
          <select value={empId ?? ''} onChange={e => setEmpId(Number(e.target.value))} style={selectStyle}>
            {data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="年">
          <select value={yr} onChange={e => setYr(Number(e.target.value))} style={selectStyle}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
        <Field label="月">
          <select value={mo} onChange={e => setMo(Number(e.target.value))} style={selectStyle}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m} 月</option>)}
          </select>
        </Field>
      </div>

      {/* 活動工作日（週末當平日算）*/}
      <div style={{ backgroundColor: E.card, border: `1px solid ${E.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <CalendarPlus size={15} style={{ color: E.brand }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: E.text }}>活動工作日（{monthStr}）</span>
          <span style={{ fontSize: 11, color: E.textMuted, marginLeft: 8 }}>
            標記後的週末日，引擎將當「平日」計算（不套休息日/例假日加成）
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={newWorkDay}
            min={`${monthStr}-01`}
            max={`${monthStr}-31`}
            onChange={e => setNewWorkDay(e.target.value)}
            style={{ ...selectStyle, padding: '6px 8px', fontFamily: 'inherit' }}
          />
          <button
            onClick={addActivityDay}
            style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 6,
              border: 'none', backgroundColor: E.brand, color: '#fff', cursor: 'pointer' }}
          >新增活動日</button>
          {activityDays.length === 0 && (
            <span style={{ fontSize: 12, color: E.textMuted, paddingLeft: 4 }}>本月尚未標記任何活動工作日</span>
          )}
          {activityDays.map(d => (
            <span key={d} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 600, padding: '4px 8px 4px 10px', borderRadius: 6,
              backgroundColor: '#f4ebd9', color: E.textSecond, border: `1px solid ${E.border}`,
            }}>
              {d}
              <button onClick={() => removeActivityDay(d)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textMuted, padding: 0, display: 'flex' }}
                title="移除"
              ><X size={12} /></button>
            </span>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: E.textMuted, lineHeight: 1.6 }}>
          提醒：勞基法第 36 條規定 7 日內須有 2 日休息（1 例假 + 1 休息日）。
          週末上班的員工，請確認該週於其他日子已調休，否則仍違法。
        </div>
      </div>

      {/* 員工薪資基準卡 */}
      {emp && setting && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
          <Stat label="月薪總額（含經常性）" value={`NT$${monthlyTotalRegularPay(setting).toLocaleString()}`} />
          <Stat label="時薪基準" value={`NT$${(Math.round(hourlyRate(setting) * 100) / 100).toLocaleString()}`} hint="月薪 ÷ 240" />
          <Stat label="薪資制度" value={setting.payType === 'monthly' ? '月薪制' : '時薪制'} />
          <Stat label="當月行政日曆時數（參考）" value={govtHrs != null ? `${govtHrs}h` : '—'} hint="不作為基準" />
        </div>
      )}

      {/* 主結果 */}
      {result ? (
        <>
          {/* 警示 */}
          {result.warnings.length > 0 && (
            <div style={{ backgroundColor: '#fff5e6', border: `1px solid ${E.warn}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} style={{ color: E.warn }} />
                <span style={{ fontWeight: 700, color: E.warn }}>合規警示 ({result.warnings.length})</span>
              </div>
              {result.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 13, color: E.textSecond, paddingLeft: 22, marginBottom: 4 }}>· {w}</div>
              ))}
            </div>
          )}

          {/* 主摘要 */}
          <div style={{ backgroundColor: E.card, border: `1px solid ${E.border}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
            <pre style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 13, lineHeight: 1.7, color: E.text, margin: 0, whiteSpace: 'pre-wrap',
            }}>{result.summary}</pre>
          </div>

          {/* 日別明細 */}
          {result.byDay.length > 0 && (
            <details style={{ backgroundColor: E.card, border: `1px solid ${E.border}`, borderRadius: 12, marginBottom: 14 }}>
              <summary style={{ padding: 14, cursor: 'pointer', fontWeight: 600, color: E.text, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ChevronDown size={14} /> 日別明細 ({result.byDay.length} 天)
              </summary>
              <div style={{ padding: '0 14px 14px', overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: E.textMuted, borderBottom: `1px solid ${E.border}` }}>
                      <th style={th}>日期</th>
                      <th style={th}>日別</th>
                      <th style={th}>正常出勤</th>
                      <th style={th}>加班</th>
                      <th style={th}>當日工資</th>
                      <th style={th}>短少分鐘</th>
                      <th style={th}>請假</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byDay.map(d => (
                      <tr key={d.date} style={{ borderBottom: `1px solid ${E.border}` }}>
                        <td style={td}>{d.date}</td>
                        <td style={td}><DayTypeBadge t={d.dayType} /></td>
                        <td style={td}>{(d.workedMin / 60).toFixed(2)}h</td>
                        <td style={td}>{d.otMin > 0 ? `${(d.otMin / 60).toFixed(2)}h` : '—'}</td>
                        <td style={td}>{d.pay > 0 ? `NT$${d.pay.toLocaleString()}` : '—'}</td>
                        <td style={{ ...td, color: d.shortMin > 0 ? E.bad : E.textMuted }}>{d.shortMin > 0 ? `${d.shortMin}` : '—'}</td>
                        <td style={td}>{d.leaveTypes.length ? d.leaveTypes.join('、') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* JSON */}
          <details open={showJson} onToggle={e => setShowJson(e.currentTarget.open)}
            style={{ backgroundColor: E.card, border: `1px solid ${E.border}`, borderRadius: 12 }}>
            <summary style={{ padding: 14, cursor: 'pointer', fontWeight: 600, color: E.text, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={14} /> JSON 輸出（供系統匯入）
            </summary>
            <pre style={{
              padding: '0 14px 14px', fontSize: 11.5, lineHeight: 1.55,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              color: E.textSecond, margin: 0, whiteSpace: 'pre-wrap',
            }}>{JSON.stringify(result.json, null, 2)}</pre>
          </details>
        </>
      ) : (
        <div style={{ padding: 40, textAlign: 'center', color: E.textMuted }}>選擇員工以開始試算</div>
      )}

      {/* 規則註記 */}
      <div style={{ marginTop: 20, padding: 12, backgroundColor: '#f5f0e5', borderRadius: 10, fontSize: 12, color: E.textMuted, lineHeight: 1.7 }}>
        <strong style={{ color: E.textSecond }}>引擎規則：</strong>
        時薪 = 月工資總額 ÷ 240。加班分級費率 1.34 / 1.67 / 2.67，金額無條件進位。
        每連續工作 4 小時扣 30 分鐘休息。一日工時上限 12h，月加班上限 46h（勞資會議放寬至 54h）。
        遲到早退依分鐘不予計薪、無條件捨去。預設週日例假、週六休息日。
        補休不再自動轉換 — 需員工申請、雇主同意。
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: E.textMuted, fontWeight: 600 }}>{label}</span>
      {children}
    </div>
  )
}

function Stat({ label, value, hint }) {
  return (
    <div style={{ backgroundColor: E.card, border: `1px solid ${E.border}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, color: E.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: E.text }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: E.textMuted, marginTop: 2 }}>{hint}</div>}
    </div>
  )
}

function DayTypeBadge({ t }) {
  const m = {
    weekday:    { label: '平日',     bg: '#eef4ec', fg: '#3a6d31' },
    restday:    { label: '休息日',   bg: '#fff5e0', fg: '#c08a30' },
    holiday:    { label: '國定假日', bg: '#fde6e0', fg: '#c04030' },
    regularoff: { label: '例假日',   bg: '#f0e6f5', fg: '#6a3a80' },
  }[t] || { label: t, bg: '#eee', fg: '#666' }
  return <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, backgroundColor: m.bg, color: m.fg }}>{m.label}</span>
}

const selectStyle = {
  fontSize: 13, padding: '6px 10px', borderRadius: 6, border: `1px solid ${E.border}`,
  backgroundColor: '#fff', color: E.text, outline: 'none', minWidth: 100,
}
const th = { textAlign: 'left', padding: '8px 10px', fontWeight: 600, fontSize: 11 }
const td = { padding: '8px 10px', color: E.textSecond }
