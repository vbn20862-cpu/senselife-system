import { E, useIsMobile } from '../styles/earth'
import { Megaphone } from 'lucide-react'

export default function Announcements() {
  const mob = useIsMobile()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>公告欄</h1>
        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', backgroundColor: '#f0ece0', color: '#8a7028', fontWeight: '600' }}>開發中</span>
      </div>
      <div style={{ ...E.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '16px' }}>
        <Megaphone size={48} style={{ color: E.textMuted }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: E.textPrimary, marginBottom: '8px' }}>公司公告欄</div>
          <div style={{ fontSize: '13px', color: E.textSecond, lineHeight: 1.6, maxWidth: '320px' }}>
            發布公司內部通知與重要訊息<br />
            釘選重要公告、支援分類標籤<br />
            員工可在首頁看到最新公告
          </div>
        </div>
        <button disabled style={{ ...E.btnPrimary, opacity: 0.4, cursor: 'default', marginTop: '8px' }}>
          + 發布公告（即將開放）
        </button>
      </div>
    </div>
  )
}
