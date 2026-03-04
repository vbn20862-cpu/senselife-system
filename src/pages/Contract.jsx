import { E } from '../styles/earth'
import { FileSignature } from 'lucide-react'

export default function Contract() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>合約管理</h1>
        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', backgroundColor: '#f0ece0', color: '#8a7028', fontWeight: '600' }}>開發中</span>
      </div>
      <div style={{ ...E.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '16px' }}>
        <FileSignature size={48} style={{ color: E.textMuted }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: E.textPrimary, marginBottom: '8px' }}>合約管理模組</div>
          <div style={{ fontSize: '13px', color: E.textSecond, lineHeight: 1.6, maxWidth: '320px' }}>
            每個案件的合約金額、簽約日期<br />
            收款進度與尾款追蹤<br />
            合約到期提醒
          </div>
        </div>
        <button disabled style={{ ...E.btnPrimary, opacity: 0.4, cursor: 'default', marginTop: '8px' }}>
          + 新增合約（即將開放）
        </button>
      </div>
    </div>
  )
}
