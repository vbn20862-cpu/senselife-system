import { E } from '../styles/earth'
import { CalendarOff } from 'lucide-react'

export default function Leave() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>請假管理</h1>
        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', backgroundColor: '#f0ece0', color: '#8a7028', fontWeight: '600' }}>開發中</span>
      </div>
      <div style={{ ...E.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '16px' }}>
        <CalendarOff size={48} style={{ color: E.textMuted }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: E.textPrimary, marginBottom: '8px' }}>請假申請模組</div>
          <div style={{ fontSize: '13px', color: E.textSecond, lineHeight: 1.6, maxWidth: '320px' }}>
            員工送出請假申請、主管線上核准<br />
            支援特休、事假、病假、公假等類型<br />
            自動連動出缺勤統計
          </div>
        </div>
        <button disabled style={{ ...E.btnPrimary, opacity: 0.4, cursor: 'default', marginTop: '8px' }}>
          + 申請請假（即將開放）
        </button>
      </div>
    </div>
  )
}
