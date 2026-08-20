import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useIsMobile } from '../styles/earth'

const MAX_W = { sm: '380px', md: '520px', lg: '700px', xl: '900px' }

export default function Modal({ title, onClose, children, size = 'md' }) {
  const mob = useIsMobile()

  // 鎖定 body 捲動，避免手機背景跟著滑動
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const modal = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: mob ? 'flex-end' : 'center', justifyContent: 'center', padding: mob ? '0' : '16px', backgroundColor: 'rgba(28,12,4,0.45)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div style={{ backgroundColor: '#fdfaf5', borderRadius: mob ? '18px 18px 0 0' : '18px', boxShadow: '0 16px 64px rgba(60,30,0,0.28), 0 4px 12px rgba(60,30,0,0.12)', width: '100%', maxWidth: mob ? '100%' : (MAX_W[size] || '520px'), maxHeight: mob ? '92dvh' : '90vh', display: 'flex', flexDirection: 'column', border: '1px solid #e5d8c8', paddingBottom: mob ? 'env(safe-area-inset-bottom)' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mob ? '14px 16px' : '16px 22px', borderBottom: '1px solid #ede5d8', flexShrink: 0 }}>
          <span style={{ fontWeight: '700', fontSize: mob ? '16px' : '15px', color: '#2c1a0e', letterSpacing: '-0.01em' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: mob ? '8px' : '4px', display: 'flex', alignItems: 'center', borderRadius: '6px', transition: 'color 0.15s, background-color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#8a3020'; e.currentTarget.style.backgroundColor = '#fce8e0' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#b09070'; e.currentTarget.style.backgroundColor = 'transparent' }}>
            <X size={mob ? 22 : 18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', flex: 1, padding: mob ? '16px' : '18px 22px' }}>
          {children}
        </div>
      </div>
    </div>
  )

  // Portal 到 body，避免被 .page-enter 的 transform 影響 position:fixed 的 containing block
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal
}
