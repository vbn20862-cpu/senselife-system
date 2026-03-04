import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Lock, Plus, Trash2, Search, CreditCard } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS } from '../styles/earth'

const FINANCE_PASSWORD_KEY = 'finance_password'
const DEFAULT_PW = 'admin1234'

function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  function check() {
    const saved = localStorage.getItem(FINANCE_PASSWORD_KEY) || DEFAULT_PW
    if (pw === saved) { onUnlock(); setErr(false) }
    else { setErr(true); setPw('') }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ ...E.card, maxWidth: '360px', width: '100%', textAlign: 'center', padding: '36px 28px' }}>
        <div style={{ width: '56px', height: '56px', backgroundColor: '#f5ede0', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Lock size={24} style={{ color: E.coffee }} />
        </div>
        <h2 style={{ fontSize: '17px', fontWeight: '700', color: E.textPrimary, margin: '0 0 6px' }}>財務管理</h2>
        <p style={{ fontSize: '13px', color: E.textMuted, margin: '0 0 20px' }}>請輸入密碼進入財務模組</p>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="輸入密碼" autoFocus
          style={{ ...E.input, textAlign: 'center', letterSpacing: '0.2em', borderColor: err ? '#c04030' : E.inputBorder, backgroundColor: err ? '#fdf0ee' : E.inputBg }} />
        {err && <p style={{ fontSize: '12px', color: '#c04030', margin: '6px 0 0' }}>密碼錯誤，請重試</p>}
        <button onClick={check} style={{ ...E.btnPrimary, width: '100%', marginTop: '14px', padding: '11px 0' }}>進入</button>
        <p style={{ fontSize: '11px', color: E.textMuted, margin: '12px 0 0' }}>預設密碼：admin1234</p>
      </div>
    </div>
  )
}

export default function Finance() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const [unlocked, setUnlocked] = useState(false)
  const [tab, setTab] = useState('reimburse')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddBank, setShowAddBank] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [newR, setNewR] = useState({ date: '', person: '', project: '', amount: '', description: '', method: '現金', receiptNo: '' })
  const [newP, setNewP] = useState({ date: '', person: '', project: '', amount: '', description: '', status: '待審核' })
  const [newBank, setNewBank] = useState({ name: '', type: 'employee', bank: '', account: '', note: '' })

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />

  const expFiltered = data.expenses.filter(e =>
    !search || e.vendor?.includes(search) || e.project?.includes(search) || e.account?.includes(search)
  )

  const TABS = [['reimburse','代墊申請'],['purchase','採購申請'],['expenses','帳目查詢'],['budget','預算總覽'],['bank','匯款帳戶']]

  function stChip(s) {
    const c = STATUS[s] || { bg: '#eee', color: '#666' }
    return { fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '600', backgroundColor: c.bg, color: c.color }
  }

  function changePassword() {
    if (!newPw) return setPwMsg('請輸入新密碼')
    if (newPw !== confirmPw) return setPwMsg('兩次輸入不一致')
    if (newPw.length < 4) return setPwMsg('密碼至少 4 個字元')
    localStorage.setItem(FINANCE_PASSWORD_KEY, newPw)
    setPwMsg('✓ 密碼已更新！')
    setTimeout(() => { setShowChangePw(false); setNewPw(''); setConfirmPw(''); setPwMsg('') }, 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>財務管理</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowChangePw(true)} style={{ ...E.btnGhost, fontSize: '12px' }}>
            <Lock size={13} /> 改密碼
          </button>
          <button onClick={() => setUnlocked(false)} style={{ ...E.btnGhost, fontSize: '12px' }}>鎖定</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#fdfaf5', borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...E.tab(tab === key), flexShrink: 0 }}>{label}</button>
        ))}
      </div>

      {/* 代墊申請 */}
      {tab === 'reimburse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增代墊</button>
          </div>
          {data.reimbursements.length === 0
            ? <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>尚無代墊記錄</div>
            : data.reimbursements.map(r => (
              <div key={r.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{r.description || '代墊款'}</span>
                    <span style={stChip(r.status)}>{r.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '4px' }}>{r.date} · {r.person} · {r.project} · {r.method}</div>
                  {r.receiptNo && <div style={{ fontSize: '12px', color: E.textMuted }}>憑證：{r.receiptNo}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary }}>NT${Number(r.amount).toLocaleString()}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                    {r.status !== '已還款' && (
                      <button onClick={() => updateItem('reimbursements', r.id, { status: '已還款' })}
                        style={{ fontSize: '11px', backgroundColor: E.green, color: '#f2f7f0', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>已還款</button>
                    )}
                    <button onClick={() => deleteItem('reimbursements', r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 採購申請 */}
      {tab === 'purchase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增申請</button>
          </div>
          {data.purchaseRequests.length === 0
            ? <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>尚無採購申請</div>
            : data.purchaseRequests.map(p => (
              <div key={p.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{p.description || '採購申請'}</span>
                    <span style={stChip(p.status)}>{p.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '4px' }}>{p.date} · {p.person} · {p.project}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary }}>NT${Number(p.amount).toLocaleString()}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                    {p.status === '待審核' && (
                      <>
                        <button onClick={() => updateItem('purchaseRequests', p.id, { status: '已核准' })} style={{ fontSize: '11px', backgroundColor: E.green, color: '#f2f7f0', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>核准</button>
                        <button onClick={() => updateItem('purchaseRequests', p.id, { status: '不核准' })} style={{ fontSize: '11px', backgroundColor: '#c04030', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>駁回</button>
                      </>
                    )}
                    <button onClick={() => deleteItem('purchaseRequests', p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 帳目查詢 */}
      {tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: E.textMuted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋廠商、專案、科目..."
              style={{ ...E.input, paddingLeft: '36px' }} />
          </div>
          <div style={{ ...E.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: E.sandLight, borderBottom: `1px solid ${E.divider}` }}>
                    {['日期','專案','類別','科目','廠商','金額'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: E.textSecond }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expFiltered.length === 0
                    ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: E.textMuted }}>無資料</td></tr>
                    : expFiltered.map((e, i) => (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2' }}>
                        <td style={{ padding: '10px 14px', color: E.textSecond }}>{e.date}</td>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontSize: '11px', backgroundColor: E.sandLight, color: E.textSecond, padding: '2px 8px', borderRadius: '6px' }}>{e.project}</span></td>
                        <td style={{ padding: '10px 14px', color: E.textSecond }}>{e.category}</td>
                        <td style={{ padding: '10px 14px', color: E.textSecond }}>{e.account}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: E.textPrimary }}>{e.vendor}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: E.coffee }}>NT${Number(e.amount).toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 預算總覽 */}
      {tab === 'budget' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.projects.filter(p => p.budget > 0).map(p => {
            const spent = data.expenses.filter(e => e.project === p.id).reduce((s, e) => s + (e.amount || 0), 0)
            const pct = Math.min((spent / p.budget) * 100, 100)
            return (
              <div key={p.id} style={E.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px' }}>{p.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: E.coffee }}>NT${spent.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: E.textMuted }}>/ NT${p.budget.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ height: '8px', backgroundColor: E.sandLight, borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '999px', backgroundColor: pct > 80 ? '#c04030' : pct > 50 ? '#c89040' : E.green, width: `${pct}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: E.textMuted, marginTop: '6px' }}>
                  <span>{pct.toFixed(1)}% 已使用</span>
                  <span>剩餘 NT${(p.budget - spent).toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 匯款帳戶 */}
      {tab === 'bank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAddBank(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增帳戶</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {data.bankAccounts.map(b => (
              <div key={b.id} style={E.card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <CreditCard size={14} style={{ color: E.green }} />
                      <span style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{b.name}</span>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: b.type === 'employee' ? '#e0e8f0' : '#ede0f5', color: b.type === 'employee' ? '#305080' : '#605080' }}>
                        {b.type === 'employee' ? '員工' : '廠商'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: E.textSecond, marginTop: '6px' }}>{b.bank}</div>
                    <div style={{ fontSize: '14px', fontFamily: 'monospace', color: E.textPrimary, marginTop: '2px', letterSpacing: '0.05em' }}>{b.account}</div>
                    {b.note && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px' }}>{b.note}</div>}
                  </div>
                  <button onClick={() => deleteItem('bankAccounts', b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 新增代墊 Modal */}
      {showAdd && tab === 'reimburse' && (
        <Modal title="新增代墊申請" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['日期 *','date','date',''],['付款人 *','person','text','員工姓名'],['說明 *','description','text','說明用途'],['憑證編號','receiptNo','text','統編/收據號'],['金額 *','amount','number','0']].map(([label,key,type,ph]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={newR[key]} onChange={e => setNewR(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>付款方式</label>
              <select value={newR.method} onChange={e => setNewR(p => ({ ...p, method: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {['現金','轉帳','信用卡'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={newR.project} onChange={e => setNewR(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="">請選擇</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => { if (!newR.date||!newR.person||!newR.amount) return; addItem('reimbursements',{id:Date.now(),...newR,amount:Number(newR.amount),status:'待還款'}); setNewR({date:'',person:'',project:'',amount:'',description:'',method:'現金',receiptNo:''}); setShowAdd(false) }}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>送出申請</button>
        </Modal>
      )}

      {/* 新增採購 Modal */}
      {showAdd && tab === 'purchase' && (
        <Modal title="新增採購申請" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['日期 *','date','date'],['申請人 *','person','text'],['說明 *','description','text'],['金額 *','amount','number']].map(([label,key,type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={newP[key]} onChange={e => setNewP(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={newP.project} onChange={e => setNewP(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="">請選擇</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => { if (!newP.date||!newP.person||!newP.amount) return; addItem('purchaseRequests',{id:Date.now(),...newP,amount:Number(newP.amount)}); setNewP({date:'',person:'',project:'',amount:'',description:'',status:'待審核'}); setShowAdd(false) }}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>送出申請</button>
        </Modal>
      )}

      {/* 新增帳戶 Modal */}
      {showAddBank && (
        <Modal title="新增匯款帳戶" onClose={() => setShowAddBank(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['姓名 / 公司名稱 *','name'],['銀行 / 郵局','bank'],['帳號 *','account']].map(([label,key]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input value={newBank[key]} onChange={e => setNewBank(p => ({ ...p, [key]: e.target.value }))} style={key==='account'?{...E.input,fontFamily:'monospace'}:E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>類型</label>
              <select value={newBank.type} onChange={e => setNewBank(p => ({ ...p, type: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="employee">員工</option><option value="vendor">廠商</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <input value={newBank.note} onChange={e => setNewBank(p => ({ ...p, note: e.target.value }))} placeholder="例：薪資、廠商付款" style={E.input} />
            </div>
          </div>
          <button onClick={() => { if (!newBank.name||!newBank.account) return; addItem('bankAccounts',{id:Date.now(),...newBank}); setNewBank({name:'',type:'employee',bank:'',account:'',note:''}); setShowAddBank(false) }}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
        </Modal>
      )}

      {/* 改密碼 Modal */}
      {showChangePw && (
        <Modal title="修改財務密碼" onClose={() => { setShowChangePw(false); setNewPw(''); setConfirmPw(''); setPwMsg('') }} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="新密碼" style={E.input} />
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="確認新密碼" style={E.input} />
            {pwMsg && <p style={{ fontSize: '12px', color: pwMsg.includes('✓') ? E.green : '#c04030', margin: 0 }}>{pwMsg}</p>}
          </div>
          <button onClick={changePassword} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>確認更改</button>
        </Modal>
      )}
    </div>
  )
}
