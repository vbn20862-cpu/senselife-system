import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Package, ArrowUpRight, ArrowDownLeft, Pencil } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS, useIsMobile } from '../styles/earth'

const CATEGORIES = ['3C','攝影器材','辦公家具','交通工具','活動器材','其他']

export default function Assets() {
  const { data, addItem, updateItem, deleteItem, logEdit } = useApp()
  const { currentUser } = useAuth()
  const [tab, setTab] = useState('list')
  const [showAdd, setShowAdd] = useState(false)
  const [showLoan, setShowLoan] = useState(null)
  const [editAsset, setEditAsset] = useState(null)
  const [newAsset, setNewAsset] = useState({ name: '', category: '3C', quantity: 1, purchaseDate: '', status: '正常', note: '', location: '' })
  const [newLoan, setNewLoan] = useState({ borrower: '', purpose: '', expectedReturn: '' })
  const mob = useIsMobile()

  function addAsset() {
    if (!newAsset.name.trim()) return
    addItem('assets', { id: Date.now(), ...newAsset })
    setNewAsset({ name: '', category: '3C', quantity: 1, purchaseDate: '', status: '正常', note: '', location: '' })
    setShowAdd(false)
  }
  function submitLoan(assetId) {
    if (!newLoan.borrower.trim()) return
    addItem('assetLoans', { id: Date.now(), assetId, assetName: data.assets.find(a => a.id === assetId)?.name, ...newLoan, loanDate: new Date().toLocaleDateString('sv-SE'), status: '借出中' })
    updateItem('assets', assetId, { status: '借出' })
    setNewLoan({ borrower: '', purpose: '', expectedReturn: '' }); setShowLoan(null)
  }
  function returnAsset(loanId, assetId) {
    updateItem('assetLoans', loanId, { status: '已歸還', returnDate: new Date().toLocaleDateString('sv-SE') })
    updateItem('assets', assetId, { status: '正常' })
  }

  function stChip(s) {
    const c = STATUS[s] || { bg: '#eee', color: '#666' }
    return { display: 'inline-block', fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '600', backgroundColor: c.bg, color: c.color }
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: E.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>公司財產</h1>
        <button onClick={() => setShowAdd(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增財產</button>
      </div>

      <div style={{ display: 'flex', gap: '4px', backgroundColor: E.cardBg, borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {[['list','財產清單'],['loans','借出記錄']].map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...E.tab(tab===key), flex: 1 }}>{label}</button>
        ))}
      </div>

      {tab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
          {data.assets.length === 0 && (
            <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px', gridColumn: '1/-1' }}>尚無財產記錄</div>
          )}
          {data.assets.map(a => (
            <div key={a.id} style={E.card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: E.sandLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={18} style={{ color: E.coffee }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>{a.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', backgroundColor: E.sandLight, color: E.textSecond, padding: '2px 8px', borderRadius: '6px' }}>{a.category}</span>
                      <span style={stChip(a.status)}>{a.status}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '5px' }}>
                      數量：{a.quantity}{a.purchaseDate ? ` · 購入：${a.purchaseDate}` : ''}
                    </div>
                    {a.location && <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '2px' }}>📍 {a.location}</div>}
                    {a.note && <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '2px' }}>{a.note}</div>}
                    {a.updatedBy && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px', fontStyle: 'italic' }}>最後編輯：{a.updatedBy} · {a.updatedAt}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <button onClick={() => setEditAsset({ ...a })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080' }}><Pencil size={14} /></button>
                  <button onClick={() => deleteItem('assets', a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                  {a.status !== '借出' && a.status !== '報廢' && (
                    <button onClick={() => setShowLoan(a.id)} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: E.green, background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>
                      <ArrowUpRight size={13} />借出
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'loans' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.assetLoans.length === 0 && (
            <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>尚無借出記錄</div>
          )}
          {data.assetLoans.map(loan => (
            <div key={loan.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>{loan.assetName}</span>
                  <span style={stChip(loan.status)}>{loan.status}</span>
                </div>
                <div style={{ fontSize: '12px', color: E.textSecond, marginTop: '4px' }}>借用人：{loan.borrower}</div>
                {loan.purpose && <div style={{ fontSize: '12px', color: E.textMuted }}>{loan.purpose}</div>}
                <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '2px' }}>
                  借出：{loan.loanDate}{loan.expectedReturn ? ` · 預計歸還：${loan.expectedReturn}` : ''}{loan.returnDate ? ` · 實際歸還：${loan.returnDate}` : ''}
                </div>
              </div>
              {loan.status === '借出中' && (
                <button onClick={() => returnAsset(loan.id, loan.assetId)} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', backgroundColor: E.green, color: '#f2f7f0', border: 'none', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', flexShrink: 0, fontWeight: '600' }}>
                  <ArrowDownLeft size={13} />歸還
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="新增公司財產" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={newAsset.name} onChange={e => setNewAsset(p => ({ ...p, name: e.target.value }))} placeholder="財產名稱 *" style={E.input} />
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>類別</label>
                <select value={newAsset.category} onChange={e => setNewAsset(p => ({ ...p, category: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>數量</label>
                <input type="number" min={1} value={newAsset.quantity} onChange={e => setNewAsset(p => ({ ...p, quantity: Number(e.target.value) }))} style={E.input} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>購入日期</label>
              <input type="date" value={newAsset.purchaseDate} onChange={e => setNewAsset(p => ({ ...p, purchaseDate: e.target.value }))} style={E.input} />
            </div>
            <input value={newAsset.location} onChange={e => setNewAsset(p => ({ ...p, location: e.target.value }))} placeholder="放置位置（例：辦公室 A 架、倉庫 2F）" style={E.input} />
            <input value={newAsset.note} onChange={e => setNewAsset(p => ({ ...p, note: e.target.value }))} placeholder="備註（可選）" style={E.input} />
          </div>
          <button onClick={addAsset} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
        </Modal>
      )}

      {showLoan && (
        <Modal title="借出申請" onClose={() => setShowLoan(null)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={newLoan.borrower} onChange={e => setNewLoan(p => ({ ...p, borrower: e.target.value }))} placeholder="借用人 *" style={E.input} />
            <input value={newLoan.purpose} onChange={e => setNewLoan(p => ({ ...p, purpose: e.target.value }))} placeholder="用途" style={E.input} />
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>預計歸還日期</label>
              <input type="date" value={newLoan.expectedReturn} onChange={e => setNewLoan(p => ({ ...p, expectedReturn: e.target.value }))} style={E.input} />
            </div>
          </div>
          <button onClick={() => submitLoan(showLoan)} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>確認借出</button>
        </Modal>
      )}

      {editAsset && (
        <Modal title="編輯財產資訊" onClose={() => setEditAsset(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={editAsset.name} onChange={e => setEditAsset(p => ({ ...p, name: e.target.value }))} placeholder="財產名稱 *" style={E.input} />
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>類別</label>
                <select value={editAsset.category} onChange={e => setEditAsset(p => ({ ...p, category: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>數量</label>
                <input type="number" min={1} value={editAsset.quantity} onChange={e => setEditAsset(p => ({ ...p, quantity: Number(e.target.value) }))} style={E.input} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>狀態</label>
              <select value={editAsset.status} onChange={e => setEditAsset(p => ({ ...p, status: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {['正常','借出','維修中','報廢'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>購入日期</label>
              <input type="date" value={editAsset.purchaseDate || ''} onChange={e => setEditAsset(p => ({ ...p, purchaseDate: e.target.value }))} style={E.input} />
            </div>
            <input value={editAsset.location || ''} onChange={e => setEditAsset(p => ({ ...p, location: e.target.value }))} placeholder="放置位置（例：辦公室 A 架、倉庫 2F）" style={E.input} />
            <input value={editAsset.note || ''} onChange={e => setEditAsset(p => ({ ...p, note: e.target.value }))} placeholder="備註（可選）" style={E.input} />
          </div>
          <button onClick={() => {
            if (!editAsset.name.trim()) return
            const now = new Date().toISOString().slice(0,16).replace('T',' ')
            const who = currentUser?.name || currentUser?.username || '未知'
            updateItem('assets', editAsset.id, { ...editAsset, updatedBy: who, updatedAt: now })
            logEdit({ user: who, action: '編輯', entityType: '公司財產', entityName: editAsset.name, summary: `${editAsset.category} · 數量 ${editAsset.quantity}` })
            setEditAsset(null)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}
    </div>
  )
}
