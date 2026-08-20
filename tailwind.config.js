/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans TC', '-apple-system', 'BlinkMacSystemFont', 'PingFang TC', 'Microsoft JhengHei', 'sans-serif'],
      },
      colors: {
        forest: {
          50:  '#f2f7f0', 100: '#e0eddb', 200: '#c3dbb9',
          300: '#9ac290', 400: '#6da463', 500: '#4d8843',
          600: '#3a6d31', 700: '#2e5627', 800: '#264620', 900: '#1e381a',
        },
        coffee: {
          50:  '#faf6f1', 100: '#f2e9de', 200: '#e4d0bc',
          300: '#d2b293', 400: '#bc8e68', 500: '#a97248',
          600: '#8f5b38', 700: '#764930', 800: '#5e3b27', 900: '#3d2518',
        },
        sand: {
          50:  '#fdfaf5', 100: '#f8f2e6', 200: '#f0e3cc',
          300: '#e5ceac', 400: '#d6b485', 500: '#c89a62',
          600: '#b07f48', 700: '#8f6338', 800: '#6b4a2a', 900: '#46301b',
        },
        sidebar: {
          bg:     '#1c2718',
          border: 'rgba(255,255,255,0.07)',
          gold:   '#c8b88a',
          active: '#4d8843',
        },
      },
      boxShadow: {
        card:    '0 2px 8px rgba(60,30,0,0.09), 0 1px 2px rgba(60,30,0,0.05)',
        'card-hover': '0 4px 16px rgba(60,30,0,0.13), 0 2px 4px rgba(60,30,0,0.07)',
        sidebar: '2px 0 12px rgba(0,0,0,0.18)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
}
