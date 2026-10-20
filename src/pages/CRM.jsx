// 客戶與廠商（CRM）：客戶（業主）、廠商、聯絡人、匯款帳戶（2026-10-20 取代主選單的「公司財產」，財產移到擴充功能）
// 客戶＝案件的 client ＋ 聯絡人類型「業主」；廠商＝聯絡人類型「廠商」＋帳目裡出現過的付款對象（排除員工）
import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { E } from '../styles/earth'
import Modal from '../components/Modal'
import Finance from './Finance'

const CONTACT_TYPES = ['業主', '政府單位', '廠商', '媒體', '其他'] // 業主、政府單位歸「客戶」；廠商歸「廠商」
const EMPTY = { name: '', type: '業主', org: '', phone: '', email: '', project: '', note: '' }
const money = n => `NT$${Math.round(n || 0).toLocaleString()}`
const norm = s => String(s || '').replace(/[\s·˙・.]/g, '').replace(/[（(].*?[)）]/g, '')

export default function CRM() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState('clients')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [open, setOpen] = useState(null)

  const projects = (data.projects || []).filter(Boolean)
  const contacts = (data.contacts || []).filter(Boolean)
  const expenses = (data.expenses || []).filter(Boolean)
  const banks = (data.bankAccounts || []).filter(Boolean)
  const staffNames = useMemo(() => new Set([...(data.employees || []).filter(Boolean).map(e => norm(e.name)), ...banks.filter(b => b.type === 'employee').map(b => norm(b.name))]), [data.employees, banks])

  const clients = useMemo(() => {
    const m = new Map()
    const get = name => { const k = norm(name); if (!m.has(k)) m.set(k, { name, projects: [], contacts: [] }); return m.get(k) }
    for (const p of projects) if (p.client && p.client !== '內部') get(p.client).projects.push(p)
    for (const c of contacts) if (c.type === '業主' || c.type === '政府單位') get(c.org || c.name).contacts.push(c)
    return [...m.values()].map(c => ({ ...c, total: c.projects.reduce((s, p) => s + Number(p.contractAmount || 0), 0) })).sort((a, b) => b.total - a.total)
  }, [projects, contacts])

  const vendors = useMemo(() => {
    const m = new Map()
    const get = name => { const k = norm(name); if (!m.has(k)) m.set(k, { name, contacts: [], spend: 0, count: 0, last: '', projects: new Set() }); return m.get(k) }
    for (const e of expenses) {
      if (!e.vendor || e.direction === '收入' || staffNames.has(norm(e.vendor))) continue
      const v = get(e.vendor); v.spend += Number(e.amount || 0); v.count++; if ((e.date || '') > v.last) v.last = e.date; if (e.project) v.projects.add(e.project)
    }
    for (const c of contacts) if (c.type === '廠商') get(c.org || c.name).contacts.push(c)
    for (const v of m.values()) v.bank = banks.find(b => b.type === 'vendor' && (norm(b.name).includes(norm(v.name)) || norm(v.name).includes(norm(b.name))))
    return [...m.values()].sort((a, b) => b.spend - a.spend)
  }, [expenses, contacts, banks, staffNames])

  const match = s => !q || String(s).toLowerCase().includes(q.toLowerCase())
  function save() {
    if (!edit.name.trim()) return alert('請填姓名或單位名稱')
    const rec = { ...edit, name: edit.name.trim() }
    if (edit.id) updateItem('contacts', edit.id, rec)
    else addItem('contacts', { ...rec, id: Date.now() })
    setEdit(null)
  }

  const TABS = [['clients', `客戶（${clients.length}）`], ['vendors', `廠商（${vendors.length}）`], ['contacts', `聯絡人（${contacts.length}）`], ...(isAdmin ? [['bank', '匯款帳戶']] : [])]
  const row = { ...E.card, padding: '12px 16px' }
  const chip = (t, bg = E.sandLight, c = E.textSecond) => <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: bg, color: c, fontWeight: 600, whiteSpace: 'nowrap' }}>{t}</span>
  const contactLine = c => (
    <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '12px', color: E.textSecond, flexWrap: 'wrap', padding: '4px 0' }}>
      <b style={{ color: E.textPrimary }}>{c.name}</b>{c.phone && <span>☎ {c.phone}</span>}{c.email && <span>✉ {c.email}</span>}{c.note && <span>｜{c.note}</span>}
      <button onClick={() => setEdit({ ...EMPTY, ...c })} style={{ ...E.btnGhost, padding: '1px 8px', fontSize: '11px', display: 'inline-flex' }}>編輯</button>
    </div>
  )

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: E.textPrimary, margin: 0 }}>客戶與廠商</h1>
        <button onClick={() => setEdit({ ...EMPTY, type: tab === 'vendors' ? '廠商' : '業主' })} style={{ ...E.btnPrimary, padding: '8px 14px', fontSize: '13px' }}>＋ 新增聯絡人</button>
      </div>
      <div style={{ display: 'flex', gap: '4px', background: E.cardBg, borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ ...E.tab(tab === k), flexShrink: 0 }}>{l}</button>)}
      </div>
      {tab !== 'bank' && <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋名稱、電話、案件…" style={{ ...E.input, maxWidth: '320px' }} />}

      {tab === 'clients' && clients.filter(c => match(c.name + c.projects.map(p => p.name + p.id).join() + c.contacts.map(x => x.name + x.phone).join())).map(c => (
        <div key={c.name} style={row}>
          <div onClick={() => setOpen(o => o === c.name ? null : c.name)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', cursor: 'pointer' }}>
            <b style={{ fontSize: '15px', color: E.textPrimary }}>{c.name}</b>
            {chip(`${c.projects.length} 個案件`)}{c.contacts.length > 0 && chip(`${c.contacts.length} 位聯絡人`)}
            {isAdmin && c.total > 0 && <span style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 700, color: E.textPrimary }}>合約 {money(c.total)}</span>}
            <span style={{ color: E.textMuted, marginLeft: isAdmin && c.total > 0 ? 0 : 'auto' }}>{open === c.name ? '▲' : '▼'}</span>
          </div>
          {open === c.name && (
            <div style={{ marginTop: '10px', borderTop: `1px solid ${E.divider}`, paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {c.projects.map(p => (
                <div key={p.id} style={{ display: 'flex', gap: '10px', fontSize: '13px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {chip(p.code || p.id, '#eef2f8', '#1a56a0')}<span style={{ color: E.textPrimary }}>{p.name}</span>
                  {p.deadline && <span style={{ color: E.textMuted, fontSize: '12px' }}>期限 {p.deadline}</span>}
                  {isAdmin && p.contractAmount ? <span style={{ marginLeft: 'auto', fontSize: '12px', color: E.textSecond }}>{money(p.contractAmount)}</span> : null}
                </div>
              ))}
              {c.contacts.map(contactLine)}
              <button onClick={() => setEdit({ ...EMPTY, type: '業主', org: c.name })} style={{ ...E.btnGhost, alignSelf: 'flex-start', padding: '3px 10px', fontSize: '12px' }}>＋ 加聯絡人</button>
            </div>
          )}
        </div>
      ))}

      {tab === 'vendors' && (
        <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px', fontSize: '13px' }}>
            <thead><tr style={{ background: E.sandLight }}>
              {['廠商', '案件', '最近交易', ...(isAdmin ? ['累計支出', '匯款帳戶'] : []), '聯絡人'].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: E.textSecond, fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {vendors.filter(v => match(v.name + [...v.projects].join() + v.contacts.map(x => x.name + x.phone).join())).map(v => (
                <tr key={v.name} style={{ borderTop: `1px solid ${E.divider}` }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: E.textPrimary }}>{v.name}</td>
                  <td style={{ padding: '8px 12px', color: E.textSecond, fontSize: '12px' }}>{[...v.projects].join('、') || '—'}</td>
                  <td style={{ padding: '8px 12px', color: E.textSecond, whiteSpace: 'nowrap' }}>{v.last || '—'}{v.count ? `（${v.count} 筆）` : ''}</td>
                  {isAdmin && <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{v.spend ? money(v.spend) : '—'}</td>}
                  {isAdmin && <td style={{ padding: '8px 12px', fontSize: '12px', color: v.bank ? '#3a6d31' : E.textMuted }}>{v.bank ? `${v.bank.bank} ${v.bank.account}` : '—'}</td>}
                  <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                    {v.contacts.map(c => <div key={c.id}>{c.name}{c.phone ? ` ☎ ${c.phone}` : ''}</div>)}
                    <button onClick={() => setEdit({ ...EMPTY, type: '廠商', org: v.name })} style={{ ...E.btnGhost, padding: '1px 8px', fontSize: '11px', display: 'inline-flex' }}>＋</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'contacts' && (contacts.filter(c => match(c.name + c.org + c.phone + c.email + c.note + c.project)).map(c => (
        <div key={c.id} style={{ ...row, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {chip(c.type || '其他', c.type === '業主' ? '#eef2f8' : c.type === '廠商' ? '#f5edd0' : E.sandLight, c.type === '業主' ? '#1a56a0' : c.type === '廠商' ? '#8a6010' : E.textSecond)}
          <b style={{ color: E.textPrimary }}>{c.name}</b>{c.org && c.org !== c.name && <span style={{ fontSize: '12px', color: E.textSecond }}>{c.org}</span>}
          {c.phone && <span style={{ fontSize: '12px', color: E.textSecond }}>☎ {c.phone}</span>}{c.email && <span style={{ fontSize: '12px', color: E.textSecond }}>✉ {c.email}</span>}
          {c.project && chip(c.project, '#eef2f8', '#1a56a0')}{c.note && <span style={{ fontSize: '12px', color: E.textMuted }}>{c.note}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
            <button onClick={() => setEdit({ ...EMPTY, ...c })} style={{ ...E.btnGhost, padding: '3px 10px', fontSize: '12px' }}>編輯</button>
            {isAdmin && <button onClick={() => { if (window.confirm(`刪除聯絡人「${c.name}」？`)) deleteItem('contacts', c.id) }} style={{ ...E.btnGhost, padding: '3px 10px', fontSize: '12px', color: '#b42318' }}>刪除</button>}
          </span>
        </div>
      )))}
      {tab === 'contacts' && !contacts.length && <div style={{ ...row, color: E.textMuted, fontSize: '13px' }}>還沒有聯絡人，按右上「新增聯絡人」。</div>}

      {tab === 'bank' && isAdmin && <Finance embedTab="bank" />}

      {edit && (
        <Modal title={edit.id ? '編輯聯絡人' : '新增聯絡人'} onClose={() => setEdit(null)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['name', '姓名或單位 *'], ['org', '所屬單位（公所、公司）'], ['phone', '電話'], ['email', 'Email'], ['note', '備註（職稱、窗口事項）']].map(([k, l]) => (
              <label key={k} style={{ fontSize: '12px', color: E.textSecond }}>{l}
                <input value={edit[k] || ''} onChange={e => setEdit(x => ({ ...x, [k]: e.target.value }))} style={{ ...E.input, marginTop: '4px' }} />
              </label>
            ))}
            <label style={{ fontSize: '12px', color: E.textSecond }}>類型
              <select value={edit.type} onChange={e => setEdit(x => ({ ...x, type: e.target.value }))} style={{ ...E.input, marginTop: '4px' }}>{CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}</select>
            </label>
            <label style={{ fontSize: '12px', color: E.textSecond }}>相關案件
              <select value={edit.project || ''} onChange={e => setEdit(x => ({ ...x, project: e.target.value }))} style={{ ...E.input, marginTop: '4px' }}>
                <option value="">不指定</option>{projects.map(p => <option key={p.id} value={p.code || p.id}>{(p.code || p.id) + '　' + p.name}</option>)}
              </select>
            </label>
            <button onClick={save} style={{ ...E.btnPrimary, padding: '10px 0', marginTop: '6px' }}>儲存</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
