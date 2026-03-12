import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, Trash2, Phone, Mail, Building2, Pencil } from 'lucide-react'
import Modal from '../components/Modal'
import { E } from '../styles/earth'

const TYPE_OPTIONS = ['廠商', '業主', '政府單位', '媒體', '其他']
const EMPTY_CONTACT = { name: '', type: '廠商', phone: '', email: '', project: '', note: '' }

export default function CRM() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('全部')
  const [showAdd, setShowAdd]       = useState(false)
  const [editContact, setEditContact] = useState(null)
  const [newContact, setNewContact] = useState(EMPTY_CONTACT)

  const filtered = data.contacts.filter(c => {
    const matchType = filterType === '全部' || c.type === filterType
    const matchSearch = !search ||
      c.name.includes(search) || c.type.includes(search) ||
      c.note?.includes(search) || c.phone?.includes(search) ||
      c.email?.includes(search)
    return matchType && matchSearch
  })

  function handleAdd() {
    if (!newContact.name.trim()) return
    addItem('contacts', { id: Date.now(), ...newContact })
    setNewContact(EMPTY_CONTACT)
    setShowAdd(false)
  }

  function handleSave() {
    if (!editContact.name.trim()) return
    updateItem('contacts', editContact.id, {
      name: editContact.name, type: editContact.type,
      phone: editContact.phone, email: editContact.email,
      project: editContact.project, note: editContact.note,
    })
    setEditContact(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 標題 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>客戶關係</h1>
        <button onClick={() => { setNewContact(EMPTY_CONTACT); setShowAdd(true) }}
          style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} />新增聯絡人
        </button>
      </div>

      {/* 搜尋 + 篩選 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋名稱、電話、備註..."
          style={{ ...E.input, flex: 1, minWidth: '180px' }} />
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {['全部', ...TYPE_OPTIONS].map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{
              padding: '7px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '500',
              cursor: 'pointer', border: 'none',
              backgroundColor: filterType === t ? E.green : '#fdfaf5',
              color: filterType === t ? '#f2f7f0' : E.textSecond,
              boxShadow: filterType === t ? 'none' : '0 1px 3px rgba(60,30,0,0.1)',
            }}>
              {t}
              {t !== '全部' && (
                <span style={{ opacity: 0.65, marginLeft: '4px' }}>
                  ({data.contacts.filter(c => c.type === t).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 統計列 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {[
          { label: '全部聯絡人', count: data.contacts.length, color: E.coffee },
          { label: '廠商', count: data.contacts.filter(c => c.type === '廠商').length, color: '#3a6d31' },
          { label: '業主', count: data.contacts.filter(c => c.type === '業主').length, color: '#305080' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ ...E.card, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 120px' }}>
            <span style={{ fontSize: '22px', fontWeight: '800', color }}>{count}</span>
            <span style={{ fontSize: '12px', color: E.textSecond }}>{label}</span>
          </div>
        ))}
      </div>

      {/* 聯絡人卡片列表 */}
      {filtered.length === 0 ? (
        <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '40px' }}>
          {search || filterType !== '全部' ? '找不到符合的聯絡人' : '尚無聯絡人，點右上角按鈕新增'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {filtered.map(c => {
            const projectName = c.project ? (data.projects.find(p => p.id === c.project)?.name || c.project) : null
            return (
              <div key={c.id} style={E.card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                      backgroundColor: c.type === '業主' ? '#e0e8f0' : c.type === '廠商' ? '#e8f0e4' : E.sandLight,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Building2 size={18} style={{ color: c.type === '業主' ? '#305080' : c.type === '廠商' ? '#3a6d31' : E.coffee }} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.name}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: '600',
                          backgroundColor: c.type === '業主' ? '#e0e8f0' : c.type === '廠商' ? '#e8f0e4' : '#f0ece0',
                          color: c.type === '業主' ? '#305080' : c.type === '廠商' ? '#3a6d31' : '#8a7028',
                        }}>{c.type}</span>
                        {projectName && (
                          <span style={{ fontSize: '11px', color: E.textMuted, padding: '2px 0' }}>
                            {projectName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button onClick={() => setEditContact({ ...c })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080', padding: '4px' }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => { if (window.confirm(`確定刪除「${c.name}」？`)) deleteItem('contacts', c.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8', padding: '4px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {(c.phone || c.email || c.note) && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${E.divider}`, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {c.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: E.textSecond }}>
                        <Phone size={11} style={{ color: E.textMuted, flexShrink: 0 }} />
                        <a href={`tel:${c.phone}`} style={{ color: E.textSecond, textDecoration: 'none' }}>{c.phone}</a>
                      </div>
                    )}
                    {c.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: E.textSecond }}>
                        <Mail size={11} style={{ color: E.textMuted, flexShrink: 0 }} />
                        <a href={`mailto:${c.email}`} style={{ color: E.textSecond, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</a>
                      </div>
                    )}
                    {c.note && (
                      <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px', fontStyle: 'italic' }}>{c.note}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal：新增聯絡人 */}
      {showAdd && (
        <Modal title="新增聯絡人" onClose={() => setShowAdd(false)}>
          <ContactForm
            value={newContact}
            onChange={setNewContact}
            projects={data.projects}
            typeOptions={TYPE_OPTIONS}
          />
          <button onClick={handleAdd}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>
            新增
          </button>
        </Modal>
      )}

      {/* Modal：編輯聯絡人 */}
      {editContact && (
        <Modal title="編輯聯絡人" onClose={() => setEditContact(null)}>
          <ContactForm
            value={editContact}
            onChange={setEditContact}
            projects={data.projects}
            typeOptions={TYPE_OPTIONS}
          />
          <button onClick={handleSave}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>
            儲存
          </button>
        </Modal>
      )}
    </div>
  )
}

/* 共用表單元件 */
function ContactForm({ value, onChange, projects, typeOptions }) {
  const set = (key, val) => onChange(p => ({ ...p, [key]: val }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>名稱 *</label>
        <input value={value.name} onChange={e => set('name', e.target.value)} placeholder="公司或聯絡人姓名" style={E.input} />
      </div>
      <div>
        <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>類型</label>
        <select value={value.type} onChange={e => set('type', e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
          {typeOptions.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>電話</label>
          <input value={value.phone} onChange={e => set('phone', e.target.value)} placeholder="02-1234-5678" style={E.input} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>Email</label>
          <input type="email" value={value.email} onChange={e => set('email', e.target.value)} placeholder="name@example.com" style={E.input} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
        <select value={value.project} onChange={e => set('project', e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
          <option value="">不綁定案件</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
        <input value={value.note} onChange={e => set('note', e.target.value)} placeholder="補充說明、職稱、備忘..." style={E.input} />
      </div>
    </div>
  )
}
