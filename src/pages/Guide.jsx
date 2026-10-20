import { useState } from 'react'
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
      '進「人事管理 → 請假」→ 點「申請請假」。',
      '選假別、開始 / 結束日期（可勾半天）、填事由，送出後等管理員核准。',
      '⚠️ 請假要在「事實發生前 1 小時」提出。臨時 / 逾時請聯絡管理員補登。',
      '假別：特休、補休、婚假、喪假、公假、公傷病假、產假、陪產假、病假（一年 30 天，2026 年為 12 天）、生理假（每月 1 天半薪，全年 3 天內不併入病假）、事假（一年 14 天）；超過上限仍可請。',
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
    icon: '🧾', title: '5. 費用報支 / 採購申請',
    items: [
      '費用報支：交通費、自己先墊錢買的東西 → 到「財務管理 → 費用報支」填「付款給誰、金額、收據編號、用途」，送出等還款。系統會自動記進帳目，不用另外記帳。',
      '採購申請：要請公司買的東西 → 到「擴充功能 → 財務工具」填項目、金額、用途。',
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

// 管理規範（公告）：勞動契約第十二條所稱「甲方於管理系統公告之管理規範」即本節。內容不得牴觸法令與契約。
const RULES_VERSION = '2026-10-16 公告'
const RULES = [
  { title: '一、出勤與打卡', items: [
    '出勤以本系統的打卡紀錄為準。上班、下班、加班開始、加班結束四種卡要成對打；沒有打卡的時間不算工作時間。',
    '打卡會記錄時間與定位，未取得定位無法打卡；系統異常打不了卡，請立刻用 LINE 通知管理員登記。',
    '忘記打卡，請在當天或下一個工作日提出補登並附佐證（照片、對話、同事證明），經管理員核定後登記；逾期不補登。',
    '由管理員補登或更正的紀錄，會在時間後標註「補登」或「更正（原 xx:xx）」。',
  ] },
  { title: '二、活動日', items: [
    '排班表「活動備註」有填的日子為活動日，由管理員依當天集合與解散時間統一登記出勤，不開放自行打卡。',
    '活動日照登記時間全算、不扣休息；前 8 小時為正常工時，超過 8 小時自動算加班。',
    '活動日有出勤者不計缺時；整天未出勤照一般規定處理。',
  ] },
  { title: '三、排班與變更', items: [
    '原則週休二日。配合活動排在週六、週日或國定假日出勤時，公司在同一週期另排休假（調休），排班表上活動日排「出勤」、調休日排「休假」。',
    '每月 1–5 日員工可自編當月班表，之後鎖定，只有管理員能改。班表排定後，表上的日期與時段就是約定的出勤時間。',
    '要改班：一般班次 3 天前、活動班次 7 天前，用系統或 LINE 提出，管理員同意後才算。',
    '每 7 天至少一天例假、一天休息日；例假日除天災事變外不出勤。',
  ] },
  { title: '四、請假', items: [
    '請假一律在系統申請，事實發生前 1 小時提出；臨時事故請在出勤時間前用 LINE 通知，事後補單。',
    '未經核准就沒到班，以曠工論。病假公司得要求檢附證明。',
    '特休只扣有排班的工作日。病假年度上限內半薪（2026 年 12 天，之後 30 天），事假無薪（一年 14 天為提示），超過仍可請。',
    '喪假依親屬關係 8／6／3 天、公假（教育召集、兵役、投票等）皆全薪，不計入上述額度。生理假每月 1 天、半薪，全年 3 天內不併入病假。',
    '時薪制人員請假依當天排班時數折算；沒有排班的日子請假不給薪。',
  ] },
  { title: '五、曠工、遲到與早退', items: [
    '約定出勤時間未到且未依程序改班，視為曠工。遲到逾 15 分鐘、早退，各記一次。',
    '單月累計 3 次，公司書面提醒並得調整次月排班；年度累計 6 次、提醒後再犯，依勞動契約與勞基法第 12 條處理。',
    '曠工連續 3 日或單月 6 日，依勞基法第 12 條第 6 款終止契約。',
    '以上只影響排班與契約，不扣薪、不罰款；缺勤的時間本來就不計薪。',
  ] },
  { title: '六、薪資計算', items: [
    '月薪制：缺時＝排班應到 − 實際 − 請假折抵，先用補休（依費率加權）抵，不足才扣薪，時薪＝月薪 ÷ 240，扣薪無條件捨去。當日加班先補當日缺時。',
    '加班超過 8 小時的部分轉補休（前 2 小時 1.34、之後 1.67），補休期限依契約，季底（3／6／9／12 月）未休完依費率折現。',
    '時薪制：（打卡時數按分鐘計＋有薪假折算＋超過 8 小時的加給）× 時薪；國定假日有排班出勤加倍；不另給津貼。',
    '2026 年 9 月 1 日起，國定假日依契約協議調移，調移後當一般工作日，調移的休假日照給。',
  ] },
  { title: '七、薪資明細與異議', items: [
    '薪資頁隨時可看當月即時計算；每月 5 日系統產生上月明細草稿，管理員審核後發布，員工點開確認。',
    '對明細有疑問，請在明細發布後 7 天內提出並指明日期，公司逐日核對後回覆；逾期依該明細發放。',
    '請在發薪日前自行查核即時計算，發薪後才提出的，依前項程序處理。',
  ] },
  { title: '八、交通費報支', items: [
    '自用車（汽車、機車）：到「財務管理 → 費用報支 → 交通費（自用車里程）」填起點、終點（可加中間點），系統用 Google 開車路線算公里數，小數點無條件捨去，每公里 3 元。',
    '每筆都要選案件、寫事由；送出後由管理員審核，核准才入帳、轉待還款。來回請把終點填回起點。',
    '客運、火車、高鐵、計程車、過路費、停車費：一律實報實銷，用「一般費用」附收據或乘車紀錄。',
    '交通費依實際出差核實報支，不是固定車馬費。',
  ] },
  { title: '九、發薪與帳戶', items: [
    '每月 15 日發前一月薪資，遇例假日順延。以匯款給付，匯費由員工負擔；請在系統登錄本人帳戶，未提供致延誤不可歸責公司。',
    '員工按「我已確認」後，該月薪資自動記入公司帳目。',
  ] },
]

function RulesSection() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ ...E.card, border: '1px solid #d9cdb8' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>📜</span>管理規範（公告）
          <span style={{ fontSize: '11px', fontWeight: '500', color: E.textMuted }}>{RULES_VERSION}</span>
        </div>
        <span style={{ fontSize: '12px', color: E.textMuted }}>{open ? '收起 ▲' : '點開 ▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '12px', color: E.textMuted, margin: 0, lineHeight: 1.6 }}>本規範為勞動契約所稱公司公告之管理規範，與契約、法令牴觸者依契約與法令。</p>
          {RULES.map(r => (
            <div key={r.title}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary, marginBottom: '4px' }}>{r.title}</div>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {r.items.map((it, i) => <li key={i} style={{ fontSize: '12.5px', color: E.textSecond, lineHeight: 1.6 }}>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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

      <RulesSection />

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
