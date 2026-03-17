import { X } from 'lucide-react'
import { useIsMobile } from '../styles/earth'

const MAX_W = { sm: '380px', md: '520px', lg: '700px', xl: '900px' }

export default function Modal({ title, onClose, children, size = 'md' }) {
  const mob = useIsMobile()
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: mob ? 'flex-end' : 'center', justifyContent: 'center', padding: mob ? '0' : '16px', backgroundColor: 'rgba(28,12,4,0.5)' }}>
      <div style={{ backgroundColor: '#fdfaf5', borderRadius: mob ? '18px 18px 0 0' : '18px', boxShadow: '0 10px 48px rgba(60,30,0,0.2)', width: '100%', maxWidth: mob ? '100%' : (MAX_W[size] || '520px'), maxHeight: mob ? '85vh' : '90vh', display: 'flex', flexDirection: 'column', border: '1px solid #e5d8c8' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mob ? '14px 16px' : '16px 22px', borderBottom: '1px solid #ede5d8' }}>
          <span style={{ fontWeight: '700', fontSize: '15px', color: '#2c1a0e' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '4px', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: mob ? '14px 16px' : '18px 22px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
