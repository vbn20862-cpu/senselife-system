import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { E, useIsMobile } from '../styles/earth'
import Modal from '../components/Modal'
import { Plus, Trash2, Pencil, Copy, ArrowLeft, Users, Printer, ClipboardPaste, Package } from 'lucide-react'
import { renderTextWithPeople } from '../utils/people'
import { localTimestamp } from '../utils/salaryCalc'

// M3：預設器材包（照慢漫霧臺文件整理，可套用後增刪）
const DEFAULT_KIT = {
  '舞台區': ['舞台、truss 架', 'PA 音響系統', '主持有線麥 ×1', '無線麥 ×2＋備用 ×1', '麥克風架', '舞台燈光', '電源捲線器／延長線', '舞台背板', '節目流程表／節目單'],
  '服務台': ['桌 ×2、椅、桌牌', '活動文宣、導覽地圖', '攤商簽到退表', '領據表', '零錢備用金', 'QR 立牌、平板', '工具箱（筆/膠帶/束帶/剪刀/美工刀/釘書機）', '垃圾袋與分類標示'],
  '餐桌區': ['餐桌、椅、桌布', '碗筷、餐盤、杯', 'buffet 檯', '保溫／保鮮設備', '佈置料件'],
  '手作區': ['桌椅', '保鮮膜／鍋具／快速爐', '碗筷組', '濕紙巾、手套'],
}
const DISPATCH_CATS = ['設計', '輸出印刷', '網宣', '策展場佈', '文書', '採購', '聯繫', '行政', '其他']

// 場地圖上傳：縮到 1000px JPEG 再存
function fileToDataUrl(file, cb) {
  const fr = new FileReader()
  fr.onload = () => {
    const img = new Image()
    img.onload = () => {
      const max = 1000
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      cb(c.toDataURL('image/jpeg', 0.82))
    }
    img.src = fr.result
  }
  fr.readAsDataURL(file)
}

// M3：A4 匯出（照慢漫霧臺文件版型）
function exportA4(act) {
  const days = dayList(act)
  const sheetGroups = (act.groups || []).filter(g => g.onSheet !== false)
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
  const th = 'background:#8a6d4a;color:#fff;padding:6px 8px;font-size:11px;text-align:left;'
  const td = 'border:1px solid #c9b899;padding:6px 8px;font-size:11px;vertical-align:top;line-height:1.55;'
  let html = `<h1 style="text-align:center;color:#7a5c34;font-size:22px;margin:6px 0 2px">${esc(act.name)}</h1>
  <div style="text-align:center;color:#8a6d4a;font-size:12px;margin-bottom:14px">
    ${esc(fmtD(act.startDate))}${act.endDate && act.endDate !== act.startDate ? ' – ' + esc(fmtD(act.endDate)) : ''}
    ${act.setupDate ? `｜進場：${esc(fmtD(act.setupDate))}` : ''}${act.location ? `｜地點：${esc(act.location)}` : ''}
  </div>`
  if ((act.groups || []).length) {
    html += `<h2 style="color:#7a5c34;font-size:15px;margin:16px 0 6px">一、工作人員編組</h2>
    <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">組別</th><th style="${th}">負責人</th><th style="${th}">組員</th><th style="${th}">主要職責</th></tr>
    ${act.groups.map(g => `<tr><td style="${td}"><b>${esc(g.name)}</b></td><td style="${td}">${esc(g.leader) || '—'}</td><td style="${td}">${esc(g.members) || '—'}</td><td style="${td}">${esc(g.duty)}</td></tr>`).join('')}</table>`
  }
  days.forEach((d, i) => {
    const slots = (act.slots || []).filter(s => s.date === d).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    if (!slots.length) return
    html += `<h2 style="color:#7a5c34;font-size:15px;margin:16px 0 6px">${['二', '三', '四', '五', '六'][i] || ''}、${esc(fmtD(d))}${act.setupDate === d ? ' 進場佈置' : ' 細部流程'}與分工</h2>
    <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">時間</th>${sheetGroups.map(g => `<th style="${th}">${esc(g.name)}${g.leader ? `（${esc(g.leader)}）` : ''}</th>`).join('')}<th style="${th}">備註</th></tr>
    ${slots.map(s => `<tr><td style="${td};white-space:nowrap"><b>${esc(s.time)}</b></td>${sheetGroups.map(g => `<td style="${td}">${esc((s.entries || {})[g.name] || (s.entries || {})[g.id] || '')}</td>`).join('')}<td style="${td}">${esc(s.note)}</td></tr>`).join('')}</table>`
  })
  for (const sec of (act.sections || [])) {
    html += `<h2 style="color:#7a5c34;font-size:15px;margin:16px 0 6px">${esc(sec.title)}</h2>
    <div style="font-size:11.5px;line-height:1.7;color:#3a2c1a;white-space:pre-wrap">${esc(sec.body)}</div>`
  }
  if ((act.checklist || []).length) {
    const zones = [...new Set(act.checklist.map(c => c.zone || '共用'))]
    html += `<h2 style="color:#7a5c34;font-size:15px;margin:16px 0 6px">器材與物資清單</h2>
    <table style="width:100%;border-collapse:collapse"><tr><th style="${th}">區域</th><th style="${th}">器材／物資</th><th style="${th}">數量</th><th style="${th}">負責</th></tr>
    ${zones.map(z => act.checklist.filter(c => (c.zone || '共用') === z).map((c, i, arr) => `<tr>${i === 0 ? `<td style="${td}" rowspan="${arr.length}"><b>${esc(z)}</b></td>` : ''}<td style="${td}">${esc(c.name)}</td><td style="${td}">${esc(c.qty)}</td><td style="${td}">${esc(c.owner)}</td></tr>`).join('')).join('')}</table>`
  }
  for (const m of (act.mapImages || [])) {
    html += `<div style="margin:14px 0;page-break-inside:avoid"><div style="color:#7a5c34;font-size:12px;font-weight:bold;margin-bottom:4px">${esc(m.name || '場地配置圖')}</div><img src="${m.dataUrl}" style="max-width:100%;border:1px solid #c9b899"/></div>`
  }
  const w = window.open('', '_blank')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(act.name)}</title>
  <style>@page{size:A4;margin:16mm 14mm}body{font-family:"PingFang TC","Noto Sans TC",sans-serif;margin:0;color:#2c1a0e}
  @media print{.noprint{display:none}}</style></head><body>
  <button class="noprint" onclick="window.print()" style="position:fixed;top:10px;right:10px;padding:8px 18px;background:#8a6d4a;color:#fff;border:none;border-radius:8px;cursor:pointer">🖨️ 列印 / 存成 PDF</button>
  ${html}
  <div style="text-align:center;color:#b09070;font-size:10px;margin-top:18px;border-top:1px solid #d9c9a9;padding-top:6px">
    主辦：${esc(act.organizer) || '—'}　｜　承辦：${esc(act.executor) || '—'}</div>
  </body></html>`)
  w.document.close()
}

/* ── M1：活動主檔＋人員編組＋組別制流程表＋排班/行事曆自動連動 ──
   舊欄位（zones/timeSlots/hardware/materials）原樣保留供線上舊版讀取；
   新欄位（setupDate/location/organizer/executor/groups/slots/syncedDates）並存。 */

const WD = ['日', '一', '二', '三', '四', '五', '六']
const todayStr = () => new Date().toLocaleDateString('sv-SE')

function fmtD(ds) {
  if (!ds) return ''
  const [, m, d] = ds.split('-').map(Number)
  return `${m}/${d}（${WD[new Date(ds + 'T00:00:00').getDay()]}）`
}
function activityDates(act) {
  if (!act.startDate) return []
  const out = []
  const d = new Date(act.startDate + 'T00:00:00')
  const end = new Date((act.endDate || act.startDate) + 'T00:00:00')
  let i = 0
  while (d <= end && i < 14) { out.push(d.toLocaleDateString('sv-SE')); d.setDate(d.getDate() + 1); i++ }
  return out
}
function dayList(act) {
  return [...(act.setupDate ? [act.setupDate] : []), ...activityDates(act)]
}
function statusOf(act) {
  const t = todayStr()
  const end = act.endDate || act.startDate
  if (!act.startDate) return { label: '未定日期', bg: '#ece9e2', color: '#6f6a5e' }
  if (end < t) return { label: '已結束', bg: '#e8e4de', color: '#7a6a5a' }
  if (act.startDate <= t) return { label: '進行中', bg: '#e4f0e8', color: '#2e6040' }
  const days = Math.round((new Date(act.startDate) - new Date(t)) / 86400000)
  return { label: `倒數 ${days} 天`, bg: '#fdf0e0', color: '#a05430' }
}
// 舊資料轉接：沒有 groups/slots 的舊活動，用 zones/timeSlots 推導檢視（編輯儲存後才寫入新欄位）
function adapt(act) {
  if (act.groups) return act
  const zones = act.zones || []
  const groups = zones.map((z, i) => ({ id: 'z' + i, name: z, leader: '', members: '', duty: '', onSheet: true }))
  const slots = (act.timeSlots || []).map(s => {
    const entries = {}
    zones.forEach((z, i) => { const v = Array.isArray(s.cells) ? s.cells[i] : (s.cells || {})[z]; if (v) entries[z] = v })
    return { id: s.id, date: s.date, time: s.time || '', entries, note: [s.theme, s.equipment].filter(Boolean).join('｜') }
  })
  return { ...act, groups, slots }
}

export default function Activities() {
  const [selectedId, setSelectedId] = useState(null)
  return selectedId
    ? <ActivityDetail id={selectedId} onBack={() => setSelectedId(null)} />
    : <ActivityList onSelect={setSelectedId} />
}

/* ══════════ 清單 ══════════ */
function ActivityList({ onSelect }) {
  const { data, addItem, update } = useApp()
  const mob = useIsMobile()
  const [showAdd, setShowAdd] = useState(false)
  const [copyFrom, setCopyFrom] = useState(null)
  const [showClosed, setShowClosed] = useState(false)

  const acts = (data.activities || []).filter(Boolean)
  const t = todayStr()
  const active = acts.filter(a => (a.endDate || a.startDate || '9999') >= t).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
  const closed = acts.filter(a => (a.endDate || a.startDate || '9999') < t).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))

  function handleCreate(form) {
    const src = copyFrom ? adapt(acts.find(a => a.id === copyFrom)) : null
    const act = {
      id: Date.now(), name: form.name.trim(), startDate: form.startDate, endDate: form.endDate || form.startDate,
      setupDate: form.setupDate || '', location: form.location || '',
      organizer: form.organizer || '', executor: form.executor || '深活共構有限公司',
      groups: src ? src.groups.map(g => ({ ...g })) : [],
      slots: [],
    }
    if (src && form.startDate && src.startDate) {
      const delta = Math.round((new Date(form.startDate) - new Date(src.startDate)) / 86400000)
      let ts = Date.now() + 1
      act.slots = (src.slots || []).map(s => {
        const d = new Date((s.date || src.startDate) + 'T00:00:00'); d.setDate(d.getDate() + delta)
        return { ...s, id: ts++, date: d.toLocaleDateString('sv-SE') }
      })
    }
    // 建立當下就同步排班活動日＋儀表板行事曆
    const newDates = dayList(act)
    const notes = { ...(data.scheduleNotes || {}) }
    for (const d of newDates) { notes[d] = act.setupDate === d ? `${act.name}(進場)` : act.name }
    update('scheduleNotes', notes)
    let ets = Date.now() + 500
    const evs = [...(data.events || []).filter(Boolean)]
    for (const d of newDates) evs.push({ id: ets++, title: act.setupDate === d ? `${act.name}(進場)` : act.name, date: d, type: '活動日', project: '', note: act.location || '', activityId: act.id })
    update('events', evs)
    act.syncedDates = newDates
    addItem('activities', act)
    setShowAdd(false); setCopyFrom(null)
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>近期活動</h1>
        <button onClick={() => { setCopyFrom(null); setShowAdd(true) }} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> 新增活動
        </button>
      </div>

      {active.length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '36px', color: E.textMuted, fontSize: '13px' }}>目前沒有進行中或即將舉行的活動</div>}
      <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
        {active.map(a => <ActCard key={a.id} act={a} data={data} onClick={() => onSelect(a.id)} onCopy={() => { setCopyFrom(a.id); setShowAdd(true) }} />)}
      </div>

      {closed.length > 0 && (
        <>
          <button onClick={() => setShowClosed(v => !v)} style={{ ...E.btnGhost, fontSize: '12px', padding: '8px 0' }}>
            {showClosed ? '收起' : `已結束的活動（${closed.length}）`}
          </button>
          {showClosed && (
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px', opacity: 0.72 }}>
              {closed.map(a => <ActCard key={a.id} act={a} data={data} onClick={() => onSelect(a.id)} onCopy={() => { setCopyFrom(a.id); setShowAdd(true) }} />)}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <ActivityFormModal
          title={copyFrom ? `複製「${acts.find(a => a.id === copyFrom)?.name}」為新活動` : '新增活動'}
          init={copyFrom ? { ...adapt(acts.find(a => a.id === copyFrom)), name: '', startDate: '', endDate: '', setupDate: '' } : null}
          onClose={() => { setShowAdd(false); setCopyFrom(null) }}
          onSave={handleCreate}
        />
      )}
    </div>
  )
}

function ActCard({ act, data, onClick, onCopy }) {
  const st = statusOf(act)
  const a = adapt(act)
  const rel = (data.dispatches || []).filter(Boolean).filter(d => d.activityId === act.id)
  return (
    <div onClick={onClick} style={{ ...E.card, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary, flex: 1 }}>{act.name}</span>
        <span style={{ fontSize: '10px', padding: '2px 9px', borderRadius: '999px', backgroundColor: st.bg, color: st.color, fontWeight: '700', flexShrink: 0 }}>{st.label}</span>
        <button onClick={e => { e.stopPropagation(); onCopy() }} title="複製為新活動"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '3px', display: 'flex' }}><Copy size={14} /></button>
      </div>
      <div style={{ fontSize: '12px', color: E.textSecond }}>
        {fmtD(act.startDate)}{act.endDate && act.endDate !== act.startDate ? ` ～ ${fmtD(act.endDate)}` : ''}
        {act.setupDate && <span style={{ color: '#a05430' }}>｜🚚 進場 {fmtD(act.setupDate)}</span>}
      </div>
      {act.location && <div style={{ fontSize: '11px', color: E.textMuted }}>📍 {act.location}</div>}
      <div style={{ fontSize: '11px', color: E.textMuted }}>
        {(a.groups || []).length} 組 · {(a.slots || []).length} 時段{rel.length > 0 ? ` · 籌備交辦 ${rel.filter(d => d.status === '已完成').length}/${rel.length}` : ''}
      </div>
    </div>
  )
}

/* ══════════ 主檔表單 ══════════ */
function ActivityFormModal({ title, init, onClose, onSave }) {
  const [f, setF] = useState({
    name: init?.name || '', startDate: init?.startDate || '', endDate: init?.endDate || '',
    setupDate: init?.setupDate || '', location: init?.location || '',
    organizer: init?.organizer || '', executor: init?.executor || '深活共構有限公司',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const ok = f.name.trim() && f.startDate
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Field label="活動名稱 *"><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="例：慢漫霧臺・農食饗宴" style={E.input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="活動開始日 *"><input type="date" value={f.startDate} onChange={e => set('startDate', e.target.value)} style={E.input} /></Field>
          <Field label="活動結束日"><input type="date" value={f.endDate} onChange={e => set('endDate', e.target.value)} style={E.input} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="進場佈置日"><input type="date" value={f.setupDate} onChange={e => set('setupDate', e.target.value)} style={E.input} /></Field>
          <Field label="地點"><input value={f.location} onChange={e => set('location', e.target.value)} placeholder="例：好茶部落風雨球場" style={E.input} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="主辦"><input value={f.organizer} onChange={e => set('organizer', e.target.value)} placeholder="例：霧台鄉公所" style={E.input} /></Field>
          <Field label="承辦"><input value={f.executor} onChange={e => set('executor', e.target.value)} style={E.input} /></Field>
        </div>
        <div style={{ fontSize: '11px', color: E.textMuted, backgroundColor: '#f0f5ed', padding: '8px 10px', borderRadius: '8px', lineHeight: 1.5 }}>
          儲存後自動：活動日與進場日標到排班表活動日（員工免自行打卡、由管理員批次補登）＋ 加進儀表板行事曆。
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
          <button onClick={() => ok && onSave(f)} disabled={!ok}
            style={{ ...E.btnPrimary, padding: '8px 18px', opacity: ok ? 1 : 0.5 }}>儲存</button>
        </div>
      </div>
    </Modal>
  )
}

/* ══════════ 詳細 ══════════ */
function ActivityDetail({ id, onBack }) {
  const { data, update, updateItem, deleteItem, addItem } = useApp()
  const { isAdmin, currentUser } = useAuth()
  const mob = useIsMobile()
  const raw = (data.activities || []).filter(Boolean).find(a => a.id === id)
  const [tab, setTab] = useState('overview')
  const [editMeta, setEditMeta] = useState(false)
  const [editGroup, setEditGroup] = useState(null)
  const [editSlot, setEditSlot] = useState(null)
  const [selDay, setSelDay] = useState(null)
  const [mobGroup, setMobGroup] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const [showQuickTask, setShowQuickTask] = useState(false)
  const [editSection, setEditSection] = useState(null)
  const [kitForm, setKitForm] = useState({ zone: '', name: '', qty: '', owner: '' })

  if (!raw) return <div style={{ ...E.card, textAlign: 'center', padding: '30px', color: E.textMuted }}>找不到活動 <button onClick={onBack} style={{ ...E.btnGhost, marginLeft: '10px' }}>返回</button></div>
  const act = adapt(raw)
  const st = statusOf(act)
  const days = dayList(act)
  const day = selDay && days.includes(selDay) ? selDay : (days.find(d => d >= todayStr()) || days[0] || '')
  const sheetGroups = (act.groups || []).filter(g => g.onSheet !== false)
  const daySlots = (act.slots || []).filter(s => s.date === day).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const relDispatches = (data.dispatches || []).filter(Boolean).filter(d => d.activityId === act.id)
  const cellText = t => renderTextWithPeople(t, data.employees, React)

  // ── 主檔儲存＋同步排班/行事曆 ──
  function saveActivity(updates) {
    const next = { ...act, ...updates }
    const newDates = dayList(next)
    const notes = { ...(data.scheduleNotes || {}) }
    for (const d of (raw.syncedDates || [])) { if ((notes[d] || '').startsWith(act.name)) delete notes[d] }
    for (const d of newDates) { notes[d] = next.setupDate === d ? `${next.name}(進場)` : next.name }
    update('scheduleNotes', notes)
    const evs = (data.events || []).filter(Boolean).filter(e => e.activityId !== act.id)
    let ts = Date.now()
    for (const d of newDates) evs.push({ id: ts++, title: next.setupDate === d ? `${next.name}(進場)` : next.name, date: d, type: '活動日', project: '', note: next.location || '', activityId: act.id })
    update('events', evs)
    updateItem('activities', act.id, { ...updates, syncedDates: newDates })
  }
  function handleDelete() {
    if (!window.confirm(`確定刪除「${act.name}」？排班活動日與行事曆標記會一併移除。`)) return
    const notes = { ...(data.scheduleNotes || {}) }
    for (const d of (raw.syncedDates || [])) { if ((notes[d] || '').startsWith(act.name)) delete notes[d] }
    update('scheduleNotes', notes)
    update('events', (data.events || []).filter(Boolean).filter(e => e.activityId !== act.id))
    deleteItem('activities', act.id)
    onBack()
  }
  function saveGroup(g) {
    const groups = g.id
      ? act.groups.map(x => x.id === g.id ? { ...g } : x)
      : [...(act.groups || []), { ...g, id: Date.now() }]
    updateItem('activities', act.id, { groups, slots: act.slots || [] })
    setEditGroup(null)
  }
  function deleteGroup(gid) {
    if (!window.confirm('確定刪除這個組？')) return
    updateItem('activities', act.id, { groups: act.groups.filter(g => g.id !== gid), slots: act.slots || [] })
  }
  function saveSlot(s) {
    const slots = s.id
      ? act.slots.map(x => x.id === s.id ? { ...s } : x)
      : [...(act.slots || []), { ...s, id: Date.now() }]
    updateItem('activities', act.id, { slots, groups: act.groups || [] })
    setEditSlot(null)
  }
  function deleteSlot(sid) {
    if (!window.confirm('確定刪除這個時段？')) return
    updateItem('activities', act.id, { slots: act.slots.filter(s => s.id !== sid), groups: act.groups || [] })
  }
  // 泛用欄位存檔（帶上 groups/slots 讓舊活動的轉接結果一併落盤）
  function patch(updates) {
    updateItem('activities', act.id, { groups: act.groups || [], slots: act.slots || [], ...updates })
  }
  // M2 器材清單
  const checklist = act.checklist || []
  function addKitItem() {
    if (!kitForm.name.trim()) return
    patch({ checklist: [...checklist, { id: Date.now(), zone: kitForm.zone.trim() || '共用', name: kitForm.name.trim(), qty: kitForm.qty.trim(), owner: kitForm.owner.trim(), loaded: false, received: false }] })
    setKitForm(f => ({ ...f, name: '', qty: '' }))
  }
  function applyDefaultKit() {
    const existing = new Set(checklist.map(c => `${c.zone}|${c.name}`))
    let ts = Date.now()
    const added = []
    for (const [zone, items] of Object.entries(DEFAULT_KIT))
      for (const name of items)
        if (!existing.has(`${zone}|${name}`)) added.push({ id: ts++, zone, name, qty: '', owner: '', loaded: false, received: false })
    if (!added.length) return window.alert('預設器材都已在清單中')
    patch({ checklist: [...checklist, ...added] })
  }
  function toggleKit(id, key) {
    patch({ checklist: checklist.map(c => c.id === id ? { ...c, [key]: !c[key] } : c) })
  }
  function deleteKit(id) { patch({ checklist: checklist.filter(c => c.id !== id) }) }
  // M2 專項細節段落
  function saveSection(s) {
    const sections = s.id ? (act.sections || []).map(x => x.id === s.id ? s : x) : [...(act.sections || []), { ...s, id: Date.now() }]
    patch({ sections }); setEditSection(null)
  }
  function deleteSection(sid) {
    if (!window.confirm('確定刪除這個段落？')) return
    patch({ sections: (act.sections || []).filter(s => s.id !== sid) })
  }
  // M2 場地圖
  function addMap(file) {
    fileToDataUrl(file, dataUrl => patch({ mapImages: [...(act.mapImages || []), { id: Date.now(), name: file.name.replace(/\.[^.]+$/, ''), dataUrl }] }))
  }
  function deleteMap(mid) {
    if (!window.confirm('確定刪除這張圖？')) return
    patch({ mapImages: (act.mapImages || []).filter(m => m.id !== mid) })
  }
  // M2 快速交辦（掛本活動）
  function createQuickTask(f) {
    addItem('dispatches', {
      id: Date.now(), category: f.category, title: f.title.trim(), projectId: '', activityId: act.id,
      assignee: f.assignee, dueDate: f.dueDate, spec: f.spec || '', status: '待辦',
      assignedBy: currentUser?.name || '', assignedDate: todayStr(), createdAt: localTimestamp(),
    })
    setShowQuickTask(false)
  }
  // M3 貼上匯入 → 時段
  function importSlots(parsed, targetDate) {
    let ts = Date.now()
    const slots = [...(act.slots || []), ...parsed.map(p => ({ id: ts++, date: targetDate, time: p.time, entries: p.entries, note: p.note }))]
    patch({ slots }); setShowImport(false)
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px' }}><ArrowLeft size={14} /> 返回</button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: E.textPrimary, margin: 0, flex: 1, minWidth: '150px' }}>{act.name}</h1>
        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', backgroundColor: st.bg, color: st.color, fontWeight: '700' }}>{st.label}</span>
        <button onClick={() => exportA4(act)} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}>
          <Printer size={13} /> 匯出 A4
        </button>
        {isAdmin && <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c09070', display: 'flex' }}><Trash2 size={15} /></button>}
      </div>

      <div style={{ display: 'flex', gap: '4px', backgroundColor: E.cardBg, borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, maxWidth: '520px', overflowX: 'auto' }}>
        {[['overview', '總覽・編組'], ['sheet', '流程表'], ['kit', '器材清單'], ['extra', '專項・場地圖']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...E.tab(tab === k), flex: 1, whiteSpace: 'nowrap' }}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div style={{ ...E.card }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', color: E.textSecond }}>
                <div>📅 {fmtD(act.startDate)}{act.endDate && act.endDate !== act.startDate ? ` ～ ${fmtD(act.endDate)}` : ''}
                  {act.setupDate && <span style={{ color: '#a05430' }}>　🚚 進場 {fmtD(act.setupDate)}</span>}</div>
                {act.location && <div>📍 {act.location}</div>}
                {(act.organizer || act.executor) && <div style={{ fontSize: '12px', color: E.textMuted }}>主辦：{act.organizer || '—'}｜承辦：{act.executor || '—'}</div>}
                <div style={{ fontSize: '11px', color: (raw.syncedDates || []).length ? '#2e6040' : '#a05430' }}>
                  {(raw.syncedDates || []).length ? `✅ 已同步排班活動日＋行事曆（${raw.syncedDates.length} 天）` : '⚠️ 尚未同步排班/行事曆 — 按「編輯」再按儲存即可同步'}
                </div>
              </div>
              <button onClick={() => setEditMeta(true)} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', fontSize: '12px' }}><Pencil size={12} /> 編輯</button>
            </div>
            <div style={{ marginTop: '10px', borderTop: `1px solid ${E.divider}`, paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: E.textSecond }}>
                <span>📋 籌備交辦 {relDispatches.filter(d => d.status === '已完成').length}/{relDispatches.length} 完成</span>
                <button onClick={() => setShowQuickTask(true)} style={{ ...E.btnGhost, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 10px' }}>
                  <Plus size={11} /> 交辦籌備工作
                </button>
              </div>
              {relDispatches.length > 0 && (
                <>
                  <div style={{ marginTop: '6px', height: '6px', borderRadius: '999px', backgroundColor: '#efe9e0', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(relDispatches.filter(d => d.status === '已完成').length / relDispatches.length * 100)}%`, height: '100%', backgroundColor: '#4d8843' }} />
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[...relDispatches].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).map(d => {
                      const done = d.status === '已完成'
                      const overdue = d.dueDate && d.dueDate < todayStr() && !done && d.status !== '取消'
                      return (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '4px 0' }}>
                          <span style={{ color: done ? '#4d8843' : overdue ? '#c0202a' : '#c9b899' }}>{done ? '✓' : '○'}</span>
                          <span style={{ flex: 1, color: done ? E.textMuted : E.textPrimary, textDecoration: d.status === '取消' ? 'line-through' : 'none' }}>{d.title}</span>
                          <span style={{ color: E.textMuted }}>{d.assignee}</span>
                          {d.dueDate && <span style={{ color: overdue ? '#c0202a' : E.textMuted, fontWeight: overdue ? '700' : '400' }}>{d.dueDate.slice(5)}</span>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={15} /> 人員編組</div>
            <button onClick={() => setEditGroup('new')} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}><Plus size={12} /> 新增組</button>
          </div>
          {(act.groups || []).length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '24px', color: E.textMuted, fontSize: '12px' }}>尚無編組 — 例：現場統籌組、服務台／市集組、舞台主持</div>}
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
            {(act.groups || []).map(g => (
              <div key={g.id} style={{ ...E.card, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary, flex: 1 }}>{g.name}</span>
                  {g.onSheet === false && <span style={{ fontSize: '9px', padding: '1px 7px', borderRadius: '999px', backgroundColor: '#ece9e2', color: '#6f6a5e' }}>不上流程表</span>}
                  <button onClick={() => setEditGroup(g)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '2px', display: 'flex' }}><Pencil size={12} /></button>
                  <button onClick={() => deleteGroup(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '2px', display: 'flex' }}><Trash2 size={12} /></button>
                </div>
                <div style={{ fontSize: '12px', color: E.textSecond }}>
                  負責人：<strong style={{ color: E.coffee }}>{g.leader || '—'}</strong>
                  {g.members && <span>｜組員：{g.members}</span>}
                </div>
                {g.duty && <div style={{ fontSize: '11px', color: E.textMuted, lineHeight: 1.5 }}>{g.duty}</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'sheet' && (
        <>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {days.map(d => (
              <button key={d} onClick={() => setSelDay(d)} style={{
                padding: '7px 13px', borderRadius: '999px', fontSize: '12px', fontWeight: d === day ? '700' : '500', cursor: 'pointer',
                border: d === day ? `2px solid ${E.coffee}` : `1px solid ${E.divider}`,
                backgroundColor: d === day ? '#efe6db' : E.cardBg, color: d === day ? E.coffee : E.textSecond,
              }}>{act.setupDate === d ? '🚚 ' : ''}{fmtD(d)}</button>
            ))}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              <button onClick={() => setShowImport(true)} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '7px 12px' }}>
                <ClipboardPaste size={13} /> 貼上匯入
              </button>
              <button onClick={() => setEditSlot('new')} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '7px 14px' }}>
                <Plus size={13} /> 新增時段
              </button>
            </span>
          </div>
          {sheetGroups.length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '20px', color: '#a05430', fontSize: '12px' }}>先到「總覽・編組」建立組別 — 流程表以組別為欄</div>}

          {mob && sheetGroups.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[null, ...sheetGroups].map(g => {
                  const key = g ? g.id : 'all'
                  const isSel = (mobGroup || 'all') === key
                  return (
                    <button key={key} onClick={() => setMobGroup(g ? g.id : null)} style={{
                      padding: '5px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: isSel ? '700' : '500', cursor: 'pointer',
                      border: 'none', backgroundColor: isSel ? E.coffee : '#f0ece5', color: isSel ? '#fff' : E.textSecond,
                    }}>{g ? g.name : '全部'}</button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {daySlots.length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '22px', color: E.textMuted, fontSize: '12px' }}>此日尚無時段</div>}
                {daySlots.map(s => {
                  const shown = mobGroup ? sheetGroups.filter(g => g.id === mobGroup) : sheetGroups
                  const cells = shown.map(g => ({ g, text: ((s.entries || {})[g.name] || (s.entries || {})[g.id] || '').trim() })).filter(x => x.text)
                  if (mobGroup && cells.length === 0) return null
                  return (
                    <div key={s.id} style={{ ...E.card, padding: '11px 13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: E.coffee }}>{s.time || '—'}</span>
                        <span style={{ flex: 1 }} />
                        <button onClick={() => setEditSlot(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '2px', display: 'flex' }}><Pencil size={12} /></button>
                        <button onClick={() => deleteSlot(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '2px', display: 'flex' }}><Trash2 size={12} /></button>
                      </div>
                      {cells.map(({ g, text }) => (
                        <div key={g.id} style={{ marginTop: '6px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: E.coffee }}>{g.name}</div>
                          <div style={{ fontSize: '12px', color: E.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{cellText(text)}</div>
                        </div>
                      ))}
                      {s.note && <div style={{ marginTop: '6px', fontSize: '11px', color: '#a05430', backgroundColor: '#fdf6ec', borderRadius: '6px', padding: '5px 8px' }}>📌 {s.note}</div>}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {!mob && sheetGroups.length > 0 && (
            <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: 'max-content' }}>
                <thead style={{ backgroundColor: E.sandLight }}>
                  <tr>
                    <th style={{ padding: '9px 12px', textAlign: 'left', color: E.textSecond, minWidth: '92px' }}>時間</th>
                    {sheetGroups.map(g => <th key={g.id} style={{ padding: '9px 12px', textAlign: 'left', color: E.textSecond, minWidth: '170px' }}>{g.name}{g.leader ? `（${g.leader}）` : ''}</th>)}
                    <th style={{ padding: '9px 12px', textAlign: 'left', color: E.textSecond, minWidth: '110px' }}>備註</th>
                    <th style={{ width: '64px' }} />
                  </tr>
                </thead>
                <tbody>
                  {daySlots.length === 0 && <tr><td colSpan={sheetGroups.length + 3} style={{ padding: '22px', textAlign: 'center', color: E.textMuted }}>此日尚無時段 — 右上「新增時段」</td></tr>}
                  {daySlots.map(s => (
                    <tr key={s.id} style={{ borderTop: `1px solid ${E.divider}`, verticalAlign: 'top' }}>
                      <td style={{ padding: '9px 12px', fontWeight: '800', color: E.coffee, whiteSpace: 'nowrap' }}>{s.time || '—'}</td>
                      {sheetGroups.map(g => (
                        <td key={g.id} style={{ padding: '9px 12px', color: E.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                          {(((s.entries || {})[g.name] || (s.entries || {})[g.id] || '').trim()) ? cellText((s.entries || {})[g.name] || (s.entries || {})[g.id]) : <span style={{ color: '#d5cabb' }}>—</span>}
                        </td>
                      ))}
                      <td style={{ padding: '9px 12px', color: '#a05430', whiteSpace: 'pre-wrap' }}>{s.note || ''}</td>
                      <td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => setEditSlot(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '2px' }}><Pencil size={13} /></button>
                        <button onClick={() => deleteSlot(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '2px' }}><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* M2 器材清單 */}
      {tab === 'kit' && (() => {
        const zones = [...new Set(checklist.map(c => c.zone || '共用'))]
        const loadedN = checklist.filter(c => c.loaded).length
        const recvN = checklist.filter(c => c.received).length
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: E.textSecond }}>
                共 {checklist.length} 項｜🚚 已裝車 <strong style={{ color: '#2e6040' }}>{loadedN}</strong>｜📦 已點收 <strong style={{ color: '#2e6040' }}>{recvN}</strong>
              </span>
              <button onClick={applyDefaultKit} style={{ ...E.btnGhost, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}>
                <Package size={13} /> 套用預設器材包
              </button>
            </div>
            {/* 快速新增列 */}
            <div style={{ ...E.card, display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 14px' }}>
              <span style={{ flex: '1 1 90px' }}><label style={{ fontSize: '10px', color: E.textMuted }}>區域</label>
                <input list="kit-zones" value={kitForm.zone} onChange={e => setKitForm(p => ({ ...p, zone: e.target.value }))} placeholder="舞台區" style={{ ...E.input, padding: '7px 10px' }} />
                <datalist id="kit-zones">{[...new Set([...Object.keys(DEFAULT_KIT), ...zones])].map(z => <option key={z} value={z} />)}</datalist>
              </span>
              <span style={{ flex: '2 1 150px' }}><label style={{ fontSize: '10px', color: E.textMuted }}>器材／物資 *</label>
                <input value={kitForm.name} onChange={e => setKitForm(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addKitItem()} placeholder="例：無線麥克風" style={{ ...E.input, padding: '7px 10px' }} /></span>
              <span style={{ flex: '0 1 70px' }}><label style={{ fontSize: '10px', color: E.textMuted }}>數量</label>
                <input value={kitForm.qty} onChange={e => setKitForm(p => ({ ...p, qty: e.target.value }))} placeholder="×2" style={{ ...E.input, padding: '7px 10px' }} /></span>
              <span style={{ flex: '0 1 90px' }}><label style={{ fontSize: '10px', color: E.textMuted }}>負責</label>
                <input list="emp-names-kit" value={kitForm.owner} onChange={e => setKitForm(p => ({ ...p, owner: e.target.value }))} placeholder="家慶" style={{ ...E.input, padding: '7px 10px' }} />
                <datalist id="emp-names-kit">{data.employees.map(e => <option key={e.id} value={e.name} />)}</datalist>
              </span>
              <button onClick={addKitItem} disabled={!kitForm.name.trim()} style={{ ...E.btnPrimary, padding: '8px 14px', fontSize: '12px', opacity: kitForm.name.trim() ? 1 : 0.5 }}>加入</button>
            </div>
            {checklist.length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '24px', color: E.textMuted, fontSize: '12px' }}>尚無器材 — 可先「套用預設器材包」再增刪</div>}
            {zones.map(z => (
              <div key={z} style={{ ...E.card, padding: '12px 14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: E.coffee, marginBottom: '6px' }}>{z}</div>
                {checklist.filter(c => (c.zone || '共用') === z).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${E.divider}`, flexWrap: 'wrap' }}>
                    <span style={{ flex: '1 1 140px', fontSize: '13px', color: E.textPrimary }}>{c.name}{c.qty ? <span style={{ color: E.textMuted }}> {c.qty}</span> : ''}</span>
                    {c.owner && <span style={{ fontSize: '11px', color: E.textMuted }}>👤{c.owner}</span>}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: c.loaded ? '#2e6040' : E.textMuted, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!c.loaded} onChange={() => toggleKit(c.id, 'loaded')} />🚚裝車</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: c.received ? '#2e6040' : E.textMuted, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!c.received} onChange={() => toggleKit(c.id, 'received')} />📦點收</label>
                    <button onClick={() => deleteKit(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '2px', display: 'flex' }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            ))}
          </>
        )
      })()}

      {/* M2 專項細節＋場地圖 */}
      {tab === 'extra' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>📑 專項執行細節</span>
            <button onClick={() => setEditSection('new')} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px' }}><Plus size={12} /> 新增段落</button>
          </div>
          {(act.sections || []).length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '22px', color: E.textMuted, fontSize: '12px' }}>放比賽執行細節、集章關卡這類深度內容（自由格式，會一併進 A4 匯出）</div>}
          {(act.sections || []).map(s => (
            <div key={s.id} style={{ ...E.card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: E.coffee, flex: 1 }}>{s.title}</span>
                <button onClick={() => setEditSection(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '2px', display: 'flex' }}><Pencil size={12} /></button>
                <button onClick={() => deleteSection(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '2px', display: 'flex' }}><Trash2 size={12} /></button>
              </div>
              <div style={{ fontSize: '12px', color: E.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{s.body}</div>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>🗺️ 場地配置圖</span>
            <label style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 12px', cursor: 'pointer' }}>
              <Plus size={12} /> 上傳圖片
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) addMap(e.target.files[0]); e.target.value = '' }} />
            </label>
          </div>
          {(act.mapImages || []).length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '22px', color: E.textMuted, fontSize: '12px' }}>尚無場地圖（上傳後自動縮圖，會進 A4 匯出）</div>}
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
            {(act.mapImages || []).map(m => (
              <div key={m.id} style={{ ...E.card, padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: E.textSecond, flex: 1 }}>{m.name}</span>
                  <button onClick={() => deleteMap(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '2px', display: 'flex' }}><Trash2 size={12} /></button>
                </div>
                <img src={m.dataUrl} alt={m.name} style={{ width: '100%', borderRadius: '8px' }} />
              </div>
            ))}
          </div>
        </>
      )}

      {editMeta && (
        <ActivityFormModal title="編輯活動" init={act} onClose={() => setEditMeta(false)}
          onSave={f => { saveActivity(f); setEditMeta(false) }} />
      )}
      {editSection && (
        <SectionModal section={editSection === 'new' ? null : editSection} onClose={() => setEditSection(null)} onSave={saveSection} />
      )}
      {showQuickTask && (
        <QuickTaskModal employees={data.employees} actName={act.name} onClose={() => setShowQuickTask(false)} onSave={createQuickTask} />
      )}
      {showImport && (
        <PasteImportModal days={days} day={day} groups={sheetGroups} setupDate={act.setupDate} onClose={() => setShowImport(false)} onImport={importSlots} />
      )}
      {editGroup && (
        <GroupModal group={editGroup === 'new' ? null : editGroup} employees={data.employees} onClose={() => setEditGroup(null)} onSave={saveGroup} />
      )}
      {editSlot && (
        <SlotModal slot={editSlot === 'new' ? null : editSlot} day={day} days={days} groups={sheetGroups} setupDate={act.setupDate} onClose={() => setEditSlot(null)} onSave={saveSlot} />
      )}
    </div>
  )
}

/* ══════════ 編組表單 ══════════ */
function GroupModal({ group, employees, onClose, onSave }) {
  const [f, setF] = useState({
    id: group?.id, name: group?.name || '', leader: group?.leader || '',
    members: group?.members || '', duty: group?.duty || '', onSheet: group?.onSheet !== false,
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  return (
    <Modal title={group ? '編輯組' : '新增組'} onClose={onClose} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Field label="組名 *"><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="例：服務台／市集組" style={E.input} /></Field>
        <Field label="負責人（員工可選、外部人員直接打字）">
          <input list="emp-names" value={f.leader} onChange={e => set('leader', e.target.value)} placeholder="例：宝琳 或 杜博森" style={E.input} />
          <datalist id="emp-names">{employees.map(e => <option key={e.id} value={e.name} />)}</datalist>
        </Field>
        <Field label="組員（頓號分隔，外部人員照打）">
          <input value={f.members} onChange={e => set('members', e.target.value)} placeholder="例：毓雯、予涵、庭瑜" style={E.input} />
        </Field>
        <Field label="主要職責">
          <textarea value={f.duty} onChange={e => set('duty', e.target.value)} rows={2} placeholder="例：來賓諮詢、攤商簽到退、集章關卡操作" style={{ ...E.input, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: E.textSecond, cursor: 'pointer' }}>
          <input type="checkbox" checked={f.onSheet} onChange={e => set('onSheet', e.target.checked)} />
          在流程表顯示為欄位（主持／講師這類可不勾）
        </label>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
          <button onClick={() => f.name.trim() && onSave(f)} disabled={!f.name.trim()}
            style={{ ...E.btnPrimary, padding: '8px 18px', opacity: !f.name.trim() ? 0.5 : 1 }}>儲存</button>
        </div>
      </div>
    </Modal>
  )
}

/* ══════════ 時段表單 ══════════ */
function SlotModal({ slot, day, days, groups, setupDate, onClose, onSave }) {
  const [f, setF] = useState({
    id: slot?.id, date: slot?.date || day, time: slot?.time || '',
    entries: { ...(slot?.entries || {}) }, note: slot?.note || '',
  })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const setEntry = (name, v) => setF(p => ({ ...p, entries: { ...p.entries, [name]: v } }))
  return (
    <Modal title={slot ? '編輯時段' : '新增時段'} onClose={onClose} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="日期">
            <select value={f.date} onChange={e => set('date', e.target.value)} style={E.input}>
              {days.map(d => <option key={d} value={d}>{setupDate === d ? '🚚' : ''}{fmtD(d)}</option>)}
            </select>
          </Field>
          <Field label="時間 *"><input value={f.time} onChange={e => set('time', e.target.value)} placeholder="例：14:00–15:00" style={E.input} /></Field>
        </div>
        {groups.map(g => (
          <Field key={g.id} label={`${g.name}${g.leader ? `（${g.leader}）` : ''}`}>
            <textarea value={f.entries[g.name] || f.entries[g.id] || ''} onChange={e => setEntry(g.name, e.target.value)} rows={2}
              placeholder="這組此時段做什麼（人名用（）括起會標色）" style={{ ...E.input, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
        ))}
        <Field label="備註"><input value={f.note} onChange={e => set('note', e.target.value)} placeholder="例：報名人數 21、提醒法法樣" style={E.input} /></Field>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
          <button onClick={() => f.time.trim() && onSave(f)} disabled={!f.time.trim()}
            style={{ ...E.btnPrimary, padding: '8px 18px', opacity: !f.time.trim() ? 0.5 : 1 }}>儲存</button>
        </div>
      </div>
    </Modal>
  )
}

/* ══════════ M2：專項段落表單 ══════════ */
function SectionModal({ section, onClose, onSave }) {
  const [f, setF] = useState({ id: section?.id, title: section?.title || '', body: section?.body || '' })
  return (
    <Modal title={section ? '編輯段落' : '新增段落'} onClose={onClose} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Field label="標題 *"><input value={f.title} onChange={e => setF(p => ({ ...p, title: e.target.value }))} placeholder="例：五、吉拿富（cinavu）比賽執行細節" style={E.input} /></Field>
        <Field label="內容（換行分點，會原樣呈現與匯出）">
          <textarea value={f.body} onChange={e => setF(p => ({ ...p, body: e.target.value }))} rows={10} style={{ ...E.input, resize: 'vertical', fontFamily: 'inherit' }} />
        </Field>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
          <button onClick={() => f.title.trim() && onSave(f)} disabled={!f.title.trim()}
            style={{ ...E.btnPrimary, padding: '8px 18px', opacity: f.title.trim() ? 1 : 0.5 }}>儲存</button>
        </div>
      </div>
    </Modal>
  )
}

/* ══════════ M2：快速交辦籌備工作 ══════════ */
function QuickTaskModal({ employees, actName, onClose, onSave }) {
  const [f, setF] = useState({ category: '策展場佈', title: '', assignee: '', dueDate: '', spec: '' })
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const ok = f.title.trim() && f.assignee
  return (
    <Modal title={`交辦籌備工作 — ${actName}`} onClose={onClose} size="sm">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Field label="類別"><select value={f.category} onChange={e => set('category', e.target.value)} style={E.input}>{DISPATCH_CATS.map(c => <option key={c}>{c}</option>)}</select></Field>
          <Field label="負責人 *"><select value={f.assignee} onChange={e => set('assignee', e.target.value)} style={E.input}><option value="">選擇</option>{employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}</select></Field>
        </div>
        <Field label="任務名稱 *"><input value={f.title} onChange={e => set('title', e.target.value)} placeholder="例：關東旗設計與輸出" style={E.input} /></Field>
        <Field label="交付日期"><input type="date" value={f.dueDate} onChange={e => set('dueDate', e.target.value)} style={E.input} /></Field>
        <Field label="規格／備註"><textarea value={f.spec} onChange={e => set('spec', e.target.value)} rows={2} style={{ ...E.input, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
        <div style={{ fontSize: '11px', color: E.textMuted }}>會出現在「交辦任務」與此活動的籌備清單，計入完成率。</div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
          <button onClick={() => ok && onSave(f)} disabled={!ok} style={{ ...E.btnPrimary, padding: '8px 18px', opacity: ok ? 1 : 0.5 }}>交辦</button>
        </div>
      </div>
    </Modal>
  )
}

/* ══════════ M3：貼上匯入（Word/Excel 表格 → 時段） ══════════ */
function PasteImportModal({ days, day, groups, setupDate, onClose, onImport }) {
  const [text, setText] = useState('')
  const [targetDate, setTargetDate] = useState(day)
  // 解析：每列 tab 分欄 → [時間, 各組..., (多的最後一欄=備註)]；無 tab 則整列塞第一組
  const parsed = React.useMemo(() => {
    const out = []
    for (const line of text.split('\n')) {
      const raw = line.replace(/\r/g, '')
      if (!raw.trim()) continue
      const cols = raw.split('\t').map(c => c.trim())
      const time = cols[0]
      if (!/\d{1,2}[:：]\d{2}/.test(time)) continue // 首欄要像時間才算資料列（自動跳過表頭）
      const entries = {}
      groups.forEach((g, i) => { if (cols[i + 1]) entries[g.name] = cols[i + 1] })
      const note = cols.length > groups.length + 1 ? cols[groups.length + 1] : ''
      out.push({ time, entries, note })
    }
    return out
  }, [text, groups])
  return (
    <Modal title="貼上匯入時段" onClose={onClose} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '11px', color: E.textMuted, backgroundColor: '#f0f5ed', padding: '8px 10px', borderRadius: '8px', lineHeight: 1.6 }}>
          從 Word / Excel 的流程表<strong>複製整個表格</strong>貼進來。欄位順序：<strong>時間｜{groups.map(g => g.name).join('｜')}｜備註</strong>。
          表頭列會自動跳過（首欄須含時間如 14:00）。
        </div>
        <Field label="匯入到哪一天">
          <select value={targetDate} onChange={e => setTargetDate(e.target.value)} style={E.input}>
            {days.map(d => <option key={d} value={d}>{setupDate === d ? '🚚' : ''}{fmtD(d)}</option>)}
          </select>
        </Field>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={9} placeholder={'14:00–15:00\t服務台開台（宝琳）\t手作場地確認（陳曦）\t套票場開始\n15:00–16:00\t…'}
          style={{ ...E.input, resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }} />
        <div style={{ fontSize: '12px', color: parsed.length ? '#2e6040' : E.textMuted }}>
          {parsed.length ? `✓ 解析出 ${parsed.length} 個時段：${parsed.map(p => p.time).join('、')}` : '尚未解析到時段（確認首欄是時間）'}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
          <button onClick={() => parsed.length && onImport(parsed, targetDate)} disabled={!parsed.length}
            style={{ ...E.btnPrimary, padding: '8px 18px', opacity: parsed.length ? 1 : 0.5 }}>匯入 {parsed.length || ''} 筆</button>
        </div>
      </div>
    </Modal>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: E.textMuted, marginBottom: '4px', display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}
