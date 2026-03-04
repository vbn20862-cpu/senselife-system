import { E } from '../styles/earth'
import { Handshake } from 'lucide-react'

export default function CRM() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>客戶關係</h1>
        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', backgroundColor: '#f0ece0', color: '#8a7028', fontWeight: '600' }}>開發中</span>
      </div>
      <div style={{ ...E.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '16px' }}>
        <Handshake size={48} style={{ color: E.textMuted }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: E.textPrimary, marginBottom: '8px' }}>客戶關係管理（CRM）</div>
          <div style={{ fontSize: '13px', color: E.textSecond, lineHeight: 1.6, maxWidth: '320px' }}>
            業主與潛在客戶完整資料<br />
            合作歷史、互動記錄<br />
            跟進提醒與開發機會管理
          </div>
        </div>
        <button disabled style={{ ...E.btnPrimary, opacity: 0.4, cursor: 'default', marginTop: '8px' }}>
          + 新增客戶（即將開放）
        </button>
      </div>
    </div>
  )
}
