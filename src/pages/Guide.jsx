import { E, useIsMobile } from '../styles/earth'

const SECTIONS = [
  {
    icon: '🔑', title: '1. 登入系統',
    items: [
      '用公司給你的「帳號 + 密碼」登入。',
      '忘記密碼，請聯絡管理員重設。',
      '建議用手機把網址加到主畫面，當 App 用。',
    ],
  },
  {
    icon: '🕐', title: '2. 打卡（每天最常用）',
    items: [
      '進「打卡頁」→ 先選自己的名字。',
      '四種卡：☀️上班、🌙下班、⏰加班開始、✅加班結束。',
      '上班、下班一定要「成對」打 —— 忘打下班卡那天會變「待補登」，要請管理員補。',
      '加班：要當天總工時超過 8 小時、而且有打「加班開始 / 加班結束」才算加班。沒打加班卡不算。',
      '手機會問是否允許定位，允許後系統會記錄你打卡的地點。',
      '活動日（公司有標的日子）由管理員統一登記出勤，你不用自己打卡。',
    ],
  },
  {
    icon: '🌴', title: '3. 請假',
    items: [
      '進「請假管理」→ 點「申請請假」。',
      '選假別、開始 / 結束日期（可勾半天）、填事由，送出後等管理員核准。',
      '⚠️ 請假要在「事實發生前 1 小時」提出。臨時 / 逾時請聯絡管理員補登。',
      '假別與扣薪：特休、補休、婚假、喪假、公假、公傷病假、產假、陪產假 → 全薪不扣；病假 → 半薪；事假 → 無薪照缺扣。',
      '請「特休」會扣特休額度、請「補休」會扣補休餘額（餘額不足會擋下）。',
    ],
  },
  {
    icon: '💰', title: '4. 查自己的薪資 / 工時 / 補休',
    items: [
      '進「財務管理 → 薪資管理」，點開自己的薪資卡。',
      '看得到：應上時數、打卡時數、本月加班→補休、補休餘額、特休剩餘、缺時、實領金額。',
      '加班會自動轉成「補休」存起來，平常可以請補休休假。',
      '季底（3/6/9/12 月底）補休沒休完的，會自動折現成加班費，跟薪水一起發。',
      '缺時 = 排班要上班但遲到 / 早退 / 沒到的少做時數，會扣薪（先用補休抵，補休不夠才扣錢）。',
    ],
  },
  {
    icon: '🧾', title: '5. 代墊 / 採購申請',
    items: [
      '代墊申請：你自己先墊錢買的東西 → 填「付款給誰、金額、收據編號、用途」，送出等還款。',
      '採購申請：要請公司買的東西 → 填項目、金額、用途。',
      '進度可在同一頁查看（待審核 / 已核准 / 已還款）。',
    ],
  },
  {
    icon: '📅', title: '6. 近期活動',
    items: [
      '進「近期活動」可看到活動的細部流程表（時段、各區工作、負責人、器材）。',
      '你的名字會用顏色標示，方便找到自己負責的部分。',
    ],
  },
  {
    icon: '💬', title: '7. 有問題怎麼辦',
    items: [
      '左下角「回報問題 / 建議」可以回報 Bug 或提建議。',
      '打卡、請假、薪資有疑問，直接聯絡管理員。',
    ],
  },
]

export default function Guide() {
  const mob = useIsMobile()
  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>📖 系統使用說明</h1>
        <p style={{ fontSize: '13px', color: E.textMuted, marginTop: '6px', lineHeight: 1.6 }}>
          深活共構管理系統員工指南。第一次使用建議從上往下看一遍，之後當作隨時查的手冊。
        </p>
      </div>

      {SECTIONS.map(sec => (
        <div key={sec.title} style={{ ...E.card }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>{sec.icon}</span>{sec.title}
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {sec.items.map((it, i) => (
              <li key={i} style={{ fontSize: '13px', color: E.textSecond, lineHeight: 1.6 }}>{it}</li>
            ))}
          </ul>
        </div>
      ))}

      <div style={{ ...E.card, backgroundColor: '#f0f5ed', border: '1px solid #cfe0c8' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary, marginBottom: '6px' }}>🔒 小提醒</div>
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li style={{ fontSize: '12px', color: E.textSecond, lineHeight: 1.6 }}>打卡會記錄時間與地點，請誠實打卡。</li>
          <li style={{ fontSize: '12px', color: E.textSecond, lineHeight: 1.6 }}>薪資資料只有你自己與管理員看得到。</li>
          <li style={{ fontSize: '12px', color: E.textSecond, lineHeight: 1.6 }}>系統資料即時同步，多裝置看到的都一樣。</li>
        </ul>
      </div>
    </div>
  )
}
