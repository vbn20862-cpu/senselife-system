import { E } from '../styles/earth'
import { FolderOpen } from 'lucide-react'

export default function Documents() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>文件庫</h1>
        <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '999px', backgroundColor: '#f0ece0', color: '#8a7028', fontWeight: '600' }}>開發中</span>
      </div>
      <div style={{ ...E.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: '16px' }}>
        <FolderOpen size={48} style={{ color: E.textMuted }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: E.textPrimary, marginBottom: '8px' }}>文件庫</div>
          <div style={{ fontSize: '13px', color: E.textSecond, lineHeight: 1.6, maxWidth: '320px' }}>
            集中管理各案件的合約、提案、驗收文件<br />
            支援 Google Drive 連結整合<br />
            依案件、類型快速搜尋
          </div>
        </div>
        <button disabled style={{ ...E.btnPrimary, opacity: 0.4, cursor: 'default', marginTop: '8px' }}>
          + 上傳文件（即將開放）
        </button>
      </div>
    </div>
  )
}
