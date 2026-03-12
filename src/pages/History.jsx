import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { ChevronLeft, ChevronRight, Archive } from 'lucide-react'
import { E, STATUS } from '../styles/earth'

const CHART_COLORS = ['#4d8843','#5b7ec9','#c89040','#8a5cb0','#c04030','#3a9080','#b06030','#607060']

function DonutChart({ slices, size = 120 }) {
  const r = 40, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {slices.map((s, i) => {
        const dash = (s.pct / 100) * circ
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={s.color} strokeWidth={18}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset} />
        )
        offset += dash
        return el
      })}
      <circle cx={cx} cy={cy} r={31} fill="#fdfaf5" />
    </svg>
  )
}

function stChip(s) {
  const c = STATUS[s] || { bg: '#eee', color: '#666' }
  return { fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '600', backgroundColor: c.bg, color: c.color }
}

export default function HistoryPage() {
  const { data } = useApp()
  const [selected, setSelected] = useState(null)

  // 取得所有結案案件
  const closedProjects = data.projects.filter(p => p.status === '結案')

  // ── 總覽畫面 ──────────────────────────────────────────
  if (!selected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Archive size={20} style={{ color: E.textSecond }} />
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>歷年紀錄</h1>
          <span style={{ fontSize: '12px', color: E.textMuted, backgroundColor: E.sandLight, padding: '2px 10px', borderRadius: '999px', border: `1px solid ${E.divider}` }}>
            {closedProjects.length} 個結案
          </span>
        </div>

        {closedProjects.length === 0 ? (
          <div style={{ ...E.card, textAlign: 'center', padding: '60px 20px', color: E.textMuted }}>
            <Archive size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
            <div style={{ fontSize: '14px' }}>尚無結案案件</div>
            <div style={{ fontSize: '12px', marginTop: '6px', opacity: 0.7 }}>案件狀態設為「結案」後會自動出現在這裡</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {closedProjects.map(p => {
              const exps = data.expenses.filter(e => e.project === p.id)
              const spent = exps.reduce((s, e) => s + (e.amount || 0), 0)
              const reimbs = data.reimbursements.filter(r => r.project === p.id)
              const tasks = data.designTasks.filter(t => t.project === p.id)
              const pct = p.budget > 0 ? Math.min((spent / p.budget) * 100, 100) : 0

              return (
                <div key={p.id}
                  style={{ ...E.card, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                  onClick={() => setSelected(p.id)}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(60,30,0,0.14)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = E.card.boxShadow}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary }}>{p.name}</span>
                        <span style={stChip('結案')}>結案</span>
                      </div>
                      <div style={{ fontSize: '12px', color: E.textMuted, marginBottom: '10px' }}>
                        {p.id} · {p.client} · 截止 {p.deadline}
                      </div>
                      {/* 統計小標籤 */}
                      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '11px', color: E.textSecond }}>
                          <span style={{ color: E.textMuted }}>支出筆數 </span>
                          <span style={{ fontWeight: '700', color: E.textPrimary }}>{exps.length}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: E.textSecond }}>
                          <span style={{ color: E.textMuted }}>代墊 </span>
                          <span style={{ fontWeight: '700', color: E.textPrimary }}>{reimbs.length}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: E.textSecond }}>
                          <span style={{ color: E.textMuted }}>設計任務 </span>
                          <span style={{ fontWeight: '700', color: E.textPrimary }}>{tasks.length}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '16px' }}>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: E.coffee }}>NT${spent.toLocaleString()}</div>
                      {p.budget > 0 && (
                        <div style={{ fontSize: '11px', color: E.textMuted }}>/ NT${p.budget.toLocaleString()}</div>
                      )}
                      <ChevronRight size={16} style={{ color: E.textMuted, marginTop: '6px' }} />
                    </div>
                  </div>
                  {p.budget > 0 && (
                    <>
                      <div style={{ height: '6px', backgroundColor: E.sandLight, borderRadius: '999px', overflow: 'hidden', marginTop: '12px' }}>
                        <div style={{ height: '100%', borderRadius: '999px', backgroundColor: pct > 90 ? '#c04030' : pct > 70 ? '#c89040' : E.green, width: `${pct}%` }} />
                      </div>
                      <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px' }}>{pct.toFixed(1)}% 預算使用率</div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── 詳細頁面 ──────────────────────────────────────────
  const p = data.projects.find(x => x.id === selected)
  if (!p) return null

  const exps = data.expenses.filter(e => e.project === p.id)
  const spent = exps.reduce((s, e) => s + (e.amount || 0), 0)
  const pct = p.budget > 0 ? Math.min((spent / p.budget) * 100, 100) : 0
  const reimbs = data.reimbursements.filter(r => r.project === p.id)
  const tasks = data.designTasks.filter(t => t.project === p.id)

  // 依類別分組
  const byCategory = {}
  exps.forEach(e => { byCategory[e.category || '其他'] = (byCategory[e.category || '其他'] || 0) + e.amount })
  const cats = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const maxCat = cats[0]?.[1] || 1
  const donutSlices = cats.map((c, i) => ({ label: c[0], val: c[1], pct: spent ? (c[1] / spent) * 100 : 0, color: CHART_COLORS[i % CHART_COLORS.length] }))

  // 依月份分組
  const byMonth = {}
  exps.forEach(e => {
    const m = (e.date || '').slice(0, 7)
    if (m) byMonth[m] = (byMonth[m] || 0) + e.amount
  })
  const months = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]))
  const maxMonth = months[0]?.[1] || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 回上頁 */}
      <button onClick={() => setSelected(null)}
        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px', padding: 0, width: 'fit-content' }}>
        <ChevronLeft size={15} /> 返回歷年紀錄
      </button>

      {/* 標題卡 */}
      <div style={E.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ fontSize: '16px', fontWeight: '700', color: E.textPrimary }}>{p.name}</span>
          <span style={stChip('結案')}>結案</span>
        </div>
        <div style={{ fontSize: '12px', color: E.textMuted, marginBottom: '14px' }}>{p.id} · {p.client} · 截止 {p.deadline}</div>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {p.budget > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted }}>總預算</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: E.textPrimary }}>NT${p.budget.toLocaleString()}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '11px', color: E.textMuted }}>總支出</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: E.coffee }}>NT${spent.toLocaleString()}</div>
          </div>
          {p.budget > 0 && (
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted }}>結餘</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: pct > 90 ? '#c04030' : E.green }}>
                NT${(p.budget - spent).toLocaleString()}
              </div>
            </div>
          )}
        </div>
        {p.budget > 0 && (
          <>
            <div style={{ height: '10px', backgroundColor: E.sandLight, borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '999px', backgroundColor: pct > 90 ? '#c04030' : pct > 70 ? '#c89040' : E.green, width: `${pct}%` }} />
            </div>
            <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '5px' }}>{pct.toFixed(1)}% 預算使用率</div>
          </>
        )}
      </div>

      {/* 類別圖 + 甜甜圈 */}
      {cats.length > 0 && (
        <div style={E.card}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary, marginBottom: '14px' }}>支出類別</div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <DonutChart slices={donutSlices} size={130} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px' }}>
              {cats.map((c, i) => (
                <div key={c[0]}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                      {c[0]}
                    </span>
                    <span style={{ fontWeight: '600', color: E.textPrimary }}>NT${c[1].toLocaleString()}</span>
                  </div>
                  <div style={{ height: '5px', backgroundColor: E.sandLight, borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', backgroundColor: CHART_COLORS[i % CHART_COLORS.length], width: `${(c[1] / maxCat) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 月份趨勢 */}
      {months.length > 0 && (
        <div style={E.card}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary, marginBottom: '14px' }}>月份支出</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {months.map(([m, v]) => (
              <div key={m}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span style={{ color: E.textSecond }}>{m}</span>
                  <span style={{ fontWeight: '600', color: E.textPrimary }}>NT${v.toLocaleString()}</span>
                </div>
                <div style={{ height: '6px', backgroundColor: E.sandLight, borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '999px', backgroundColor: E.green, width: `${(v / maxMonth) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 支出明細 */}
      <div style={{ ...E.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${E.divider}`, fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>
          支出明細（{exps.length} 筆）
        </div>
        {exps.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: E.textMuted, fontSize: '13px' }}>無支出紀錄</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: E.sandLight }}>
                  {['日期','類別','廠商','金額','科目'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontWeight: '600', color: E.textSecond }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exps.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2' }}>
                    <td style={{ padding: '9px 14px', color: E.textSecond }}>{e.date}</td>
                    <td style={{ padding: '9px 14px', color: E.textSecond }}>{e.category}</td>
                    <td style={{ padding: '9px 14px', fontWeight: '600', color: E.textPrimary }}>{e.vendor}</td>
                    <td style={{ padding: '9px 14px', fontWeight: '700', color: E.coffee }}>NT${e.amount.toLocaleString()}</td>
                    <td style={{ padding: '9px 14px', color: E.textMuted }}>{e.account}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 代墊申請 */}
      <div style={{ ...E.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${E.divider}`, fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>
          代墊申請（{reimbs.length} 筆）
        </div>
        {reimbs.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: E.textMuted, fontSize: '13px' }}>無代墊紀錄</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {reimbs.map((r, i) => (
              <div key={r.id} style={{ padding: '12px 16px', borderBottom: i < reimbs.length - 1 ? `1px solid ${E.divider}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{r.description || '代墊款'}</span>
                    <span style={stChip(r.status)}>{r.status}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px' }}>{r.date} · {r.person} · {r.method}</div>
                </div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: E.coffee, flexShrink: 0, marginLeft: '12px' }}>NT${Number(r.amount).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 設計任務 */}
      <div style={{ ...E.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${E.divider}`, fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>
          設計任務（{tasks.length} 筆）
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: E.textMuted, fontSize: '13px' }}>無設計任務</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {tasks.map((t, i) => (
              <div key={t.id} style={{ padding: '12px 16px', borderBottom: i < tasks.length - 1 ? `1px solid ${E.divider}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{t.title}</span>
                    <span style={stChip(t.status)}>{t.status}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px' }}>負責：{t.assignee} · 期限 {t.dueDate}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
