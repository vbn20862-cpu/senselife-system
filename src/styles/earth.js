import { useState, useEffect } from 'react'

// 響應式 hook — 768px 以下為手機
export function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const h = (e) => setM(e.matches)
    setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

// 深活共構 大地色系 共用樣式
export const E = {
  // 顏色
  bg:          '#e8d5be',
  cardBg:      '#ffffff',
  cardBorder:  '#e0cdb8',
  cardShadow:  '0 2px 12px rgba(80,20,0,0.10), 0 1px 3px rgba(80,20,0,0.06)',
  cardShadowHover: '0 6px 24px rgba(80,20,0,0.16), 0 2px 6px rgba(80,20,0,0.09)',

  textPrimary: '#2c1208',
  textSecond:  '#7a4a30',
  textMuted:   '#b08060',

  green:       '#c85c28',
  greenLight:  '#faeee6',
  greenText:   '#9a3a10',

  coffee:      '#8f5b38',
  coffeeLight: '#f5ede4',

  sand:        '#c89a62',
  sandLight:   '#f8f0e4',

  divider:     '#e8d5be',
  inputBg:     '#fffaf5',
  inputBorder: '#d8c0a8',

  // 元件
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e0cdb8',
    borderRadius: '14px',
    boxShadow: '0 2px 12px rgba(80,20,0,0.10), 0 1px 3px rgba(80,20,0,0.06)',
    padding: '20px',
  },

  // 按鈕
  btnPrimary: {
    backgroundColor: '#c85c28',
    color: '#fff8f4',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 18px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.15s, box-shadow 0.15s',
    boxShadow: '0 1px 4px rgba(200,92,40,0.3)',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    color: '#3a6d31',
    border: '1px solid #b8d0b0',
    borderRadius: '8px',
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  btnDanger: {
    backgroundColor: '#c04030',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },

  // 輸入框
  input: {
    width: '100%',
    border: '1px solid #d8cbb8',
    borderRadius: '10px',
    padding: '9px 12px',
    fontSize: '14px',
    outline: 'none',
    backgroundColor: '#fdfaf5',
    color: '#2c1a0e',
    boxSizing: 'border-box',
  },

  // 標籤 chips
  chip: (bg, color) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: '500',
    backgroundColor: bg,
    color,
  }),

  // Tab 按鈕
  tab: (active) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: active ? '600' : '500',
    backgroundColor: active ? '#c85c28' : 'transparent',
    color: active ? '#fff8f4' : '#7a4a30',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
}

// 狀態顏色
export const STATUS = {
  '執行中': { bg: '#e8f0e4', color: '#3a6d31' },
  '企劃中': { bg: '#e8e4f0', color: '#5a4a8a' },
  '結案':   { bg: '#e8e4de', color: '#7a6a5a' },
  '長期':   { bg: '#f0e8de', color: '#8a6a48' },
  '暫停':   { bg: '#f5e4e0', color: '#8a3020' },
  '提案中': { bg: '#f0ece0', color: '#8a7028' },
  '完成':   { bg: '#e4f0e8', color: '#2e6040' },
  '待辦':   { bg: '#fef3cd', color: '#8a6d1a' },
  '已完成': { bg: '#e4f0e8', color: '#2e6040' },
  '進行中': { bg: '#e0e8f0', color: '#305080' },
  '待開始': { bg: '#ece8e4', color: '#6a5a4a' },
  '待審核': { bg: '#f0ece0', color: '#8a7028' },
  '已還款': { bg: '#e4f0e8', color: '#2e6040' },
  '待還款': { bg: '#f5ece0', color: '#8a5828' },
  '已核准': { bg: '#e4f0e8', color: '#2e6040' },
  '不核准': { bg: '#f5e4e0', color: '#8a3020' },
  '正常':   { bg: '#e4f0e8', color: '#2e6040' },
  '維修中': { bg: '#f0ece0', color: '#8a7028' },
  '報廢':   { bg: '#f5e4e0', color: '#8a3020' },
  '借出':   { bg: '#e0e8f5', color: '#305080' },
  '借出中': { bg: '#e0e8f5', color: '#305080' },
  '已歸還': { bg: '#e4f0e8', color: '#2e6040' },
  '待付':   { bg: '#f5ece0', color: '#8a5828' },
  '已付':   { bg: '#e4f0e8', color: '#2e6040' },
}
