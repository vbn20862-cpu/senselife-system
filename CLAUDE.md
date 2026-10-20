# 深活共構管理系統 — Agent 操作手冊

公司內部管理系統（打卡/薪資/請假/交辦/活動/財務）。老闆＝阿慶（林家慶）。
本檔是任何 agent（Claude Code、OpenClaw 機器人）在任何機器上接手本專案的操作依據。

## 架構（事實，已查）

- **前端**：React 18 + Vite，單頁應用，路由在 `src/App.jsx`，選單在 `src/components/Layout.jsx`
- **資料**：Firebase Realtime Database（REST 端點 `https://senselifemaker-default-rtdb.firebaseio.com`）
  - 業務資料在 `/appData`，帳號在 `/accounts`
  - ⚠️ 目前規則全開（未登入可讀寫、密碼明文）——已知風險，待鎖（見待辦）
- **程式碼**：GitHub `https://github.com/vbn20862-cpu/senselife-system`（**公開** repo，
  勿放任何密鑰／個資；備份檔在 `~/senselife-backups/` 不入 git）
- **部署**：Netlify `https://senselife-system.netlify.app`
  - **push `main` 即自動建置上線**（webhook + deploy key 已接，`netlify.toml` 已設定）
  - 手動備援：`npm run build && npx netlify-cli deploy --prod --dir=dist`（Netlify 帳號 wewewewe0327@gmail.com）
  - 本 repo 的 git 身分已設 `ching <wewewewe0327@gmail.com>`，新機器 clone 後照設
- **薪資引擎**：`src/utils/payrollEngine.js`（走法B）＋ `src/utils/salaryCalc.js`

## 版本號（`src/version.js`，畫面右下角顯示）

- 格式 `V年.大版.小版`，起點 **V26.07.01**（2026-10-06）
- 小更新／小改動 → 小版 +1（01→02→03）；大改動／大更新 → 大版 +1（07→08）、小版歸 01；跨年 → 年份更新
- **每次上線前先跳版本號，上線後回報阿慶「目前版本 Vxx.xx.xx」**

## 鐵則（違反＝任務失敗）

1. **部署前先 preview 給阿慶看，拿到明確「可以」才上線**。改動累積成批，不要每個小改都部署。
2. **不要整包重寫 `/appData`**。寫入一律走分區（`/appData/<key>`）或單筆追加——
   整包重寫曾造成 UTF-8 亂碼與互相蓋寫（見 ops/repair-garbled.mjs 的由來）。
3. **測試資料一律用 `[測]` 前綴**，測完立刻清掉並驗證零殘留。
4. **薪資相關改動**：先用真實資料驗算並列數字給阿慶確認，再上線。
5. 標了【逐字】的文案（族語尤其）一字不改。
6. **員工看得到的資料不可出現「阿慶」**（打卡備註、請假事由、發給員工的薪資明細等）。補登備註只寫「補登」「更正（原 xx:xx）」「補登（依…平均時間）」這類中性字樣。

## 資料雷區（都是真實踩過的）

- Firebase key **不能含 `/`**（例：區域名「服務台/市集區」曾炸掉物件）→ 用陣列結構
- 陣列可能有 **null 空洞**（斷網寫入失敗殘留）→ 讀取端已在 `AppContext.cleanFirebaseData` 過濾；
  資料端用 `node ops/compact-arrays.mjs` 壓實
- 歷史**亂碼**（U+FFFD）→ `node ops/repair-garbled.mjs`（dry-run），確認後 `--fix`
- 日期一律 `toLocaleDateString('sv-SE')`（**禁用** `toISOString().split('T')[0]`，UTC 會差一天）
- Node 腳本寫 Firebase 必須 `Buffer.from(JSON.stringify(body),'utf8')` ＋ charset header

## 業務規則摘要（詳見程式註解）

- 加班：只有打「加班開始/結束」卡才算；月薪制→超過8h部分轉補休（1.34/1.67），
  **國定假日 2026/9/1 起當一般工作日（調移到其他天休，不×2）**，常數 `HOLIDAY_AS_WORKDAY_FROM`；之前×2，
  季底(3/6/9/12月)未休折現；**時薪制→時數×時薪×1.0 直接併薪**，不入補休
- 缺時＝排班應到而少做的時數：先用補休抵，不足才扣薪（時薪 = 經常性給與÷240）
  - **當日加班先補當日缺時**（2026-10-15 阿慶定）；當日正常＋加班超過 8h 的部分才轉補休
- 停班（颱風/豪雨）：沒出勤＝無薪但**不算曠職**；部分停班整塊計
- 時薪制時數＝實際打卡＋已核准有薪假折算（全薪8h/病假4h/事假0）＋加班；**不以排班補足**
- 病假：年度上限內半薪（2026 年 12 天、之後 30 天，整年累計含 9 月前），超過仍可請但無薪；
  事假一年 14 天僅提示，超過仍可請
- 特休只扣有排班的工作日（排休日、週末、國定假日不扣；2026-10-16 改，勞基法特休僅用於工作日）
  `payrollEngine.annualLeaveHoursOnDate`；病假/事假年度天數仍按請假單 days 計
- **不再產生月底薪資單**（2026-09 拔除）：員工頁與管理員頁的實領都是 `buildDraftSlips` 即時計算，勿另寫一套；
  舊的 `/appData/payrolls` 歷史資料保留在資料庫、僅 Excel 匯出會帶出
- **薪資明細流程**：每月 5 號 Netlify 排程函式 `netlify/functions/monthly-drafts.mjs`（與手動版
  `node ops/monthly-statements.mjs [YYYY-MM] --upload` 共用 `ops/lib/statements-core.mjs`）→ 草稿存 `/payDrafts/<empId>/<YYYY-MM>`（只有管理員看得到）→
  阿慶在薪資頁審核按「審核通過，發布」→ 存 `/payStatements/…`，員工點開確認；人工調整後用
  `node ops/publish-statement.mjs <姓名> <YYYY-MM> <html> --net=<實領>` 發布
- **員工確認才入帳**：員工按「我已確認」時，實領自動記一筆 Admin_sl／人事／人事費用 支出，日期＝次月 16 日（發薪日）
  （`payStatementKey=<empId>/<YYYY-MM>`，重發後再確認只更新不重複）；發布時要帶實領（草稿自帶 net、手動用 `--net`）
- 休息扣除：每連續段照勞基法 §35（>4h 扣 30 分、>8h 扣 60 分、>12h 扣 90 分）
- **活動日**（排班表「活動備註」有填，阿慶統一登打）2026/9/1 起：照登打時間全算、不扣休息；
  前 8h 為正常工時，**超過 8h 自動算加班**（月薪制轉補休、時薪制 ×1.0 併薪；2026-10-15 阿慶定，勞基法 §24）。
  `salaryCalc.normalDayMinutes`／`activityExtraOTMinutes`／`ACTIVITY_RAW_FROM`
- 員工排班：當月 1–5 號可自編，之後鎖定僅管理員
- 打卡地理圍欄（2026-10-16）：只能在 `Checkin.jsx` PUNCH_ZONES 多邊形區域內打卡（阿慶在地圖上畫的四角區域，涵蓋瑪家和平路
  與北葉辦公室；離邊界 ≤ 手機誤差且 ≤50 公尺也算）。地圖工具在 company-system/_map/（git 忽略）。活動日、外勤由管理員在打卡後台登記。
  **加班開始／加班結束不受定位限制**（有定位照記）；加班結束必填「加班內容」（≥4 字，存在 clockin.note「加班內容：…」）（2026-10-19）。
  **延續加班**（2026-10-20）：只打上下班、從上班起算第 9～10 小時為休息，第 10 小時後進加班池（`salaryCalc.extendedOTInfo`），下班打卡必填原因，
  存在下班卡 otReason/otStatus（待核准／核准／駁回）＋otRejectReason；核准才計入（併入 activityExtraOTMinutes），10/1 起回溯、活動日不適用。
  管理員「出勤審核」頁 /attendance-review（選單紅點＝待核准＋缺下班卡）：核准／駁回（5 個法定理由＋其他）、缺卡補登、加班卡內容、跨日、補登更正。
  跨日下班：06:00 前打下班、今天無上班卡、前一天有上班沒下班 → 記在前一天，note「跨日下班（實際 MM/DD HH:MM）」（2026-10-20）
- **Google 日曆同步**（2026-10-20，老闆只看日曆）：`netlify/functions/calendar-sync.mjs` 每天 06:00 排程（排程函式正式站不接受網址呼叫）＋`calendar-sync-now.mjs` 供前端在核准請假／補登／改班表時 POST 觸發，共用 `netlify/lib/calendar-sync-core.mjs`，
  把「已核准請假」與「排班表平日休假（週一～五、非國定假日）」寫成公司日曆的全天事件（標題「姓名 假別」「姓名 休假」，一律紅色 colorId 11），
  用 extendedProperties.private.slSource/slKey 認領，改了、刪了會跟著更新。需 Netlify 環境變數 GOOGLE_SA_JSON_B64（服務帳號金鑰 base64，
  日曆要分享「變更活動」給服務帳號）、GOOGLE_CALENDAR_ID；選填 CALENDAR_SYNC_TOKEN＝VITE_CALENDAR_SYNC_TOKEN。服務帳號 senselife-calendar@mystic-berm-493306-m9（2026-10-20 建，金鑰只在 Netlify）。請假頁管理員有「同步 Google 日曆」按鈕
- 「代墊申請」2026-10-20 改名「費用報支」（資料 key 仍是 reimbursements，交通費與員工自墊都走這裡，送出自動入帳目；1–5 月 26 筆未入帳的舊代墊阿慶決定不補）
- **交通費報支**（2026-10-20）：自用車里程＝Google Routes API 開車距離（netlify/functions/route-distance.mjs，用同一服務帳號 OAuth，GCP 專案 mystic-berm-493306-m9 需啟用 Routes API＋帳單）公里無條件捨去 × 3 元；
  員工送出「待審核」（不入帳），管理員核准才入帳目（科目 旅費、類別 交通）轉待還款，駁回要寫理由。其他交通（客運火車計程車過路停車）一般報支實報實銷。財務管理紅點＝待審核報支
- 交辦（dispatches）＝執行主系統，扁平一列一事；帳務缺欄進紅字不計預算；發票號硬擋

## 日常維運（機器人的工作）

```bash
node ops/health-check.mjs      # 每日健檢（唯讀；exit 1 = 有事要報）
node ops/backup.mjs            # 每日備份到 ~/senselife-backups/（repo 外，含個資勿入 git）
node ops/compact-arrays.mjs    # 有空洞時壓實
node ops/repair-garbled.mjs    # 有亂碼時 dry-run → 確認 → --fix
```

建議排程：每天 08:30 跑 backup + health-check，異常摘要推 LINE/Discord 給阿慶。

## 帳號

人事管理頁籤（2026-10-20 整合）：班表／出勤（src/components/hr/AttendanceTab.jsx：審核＋打卡清單改刪增，取代打卡後台）／工時（WorkHoursTab.jsx，用薪資引擎）／員工（含登入帳號、重設密碼；改名雙向同步帳號）／操作紀錄。
HR.jsx 內舊的 attendance_old、clockin_old、accounts 區塊已不顯示，確認穩定後可刪。

管理員 `admin`／員工帳號見 `/accounts`（明文，待改雜湊）。員工登入靠
`accounts.name === employees.name` 對應，改名要兩邊同步。

## 待辦（跨 session 交接）

- 🔴 Firebase 安全規則鎖定＋密碼雜湊（最大洞）
- 案件駕駛艙：案件→階段(里程碑)→交辦，已拍板「委託案五階段」範本；
  三個執行中案件的階段設定還在等阿慶回覆
- npm audit：剩 5 個 braces（建置期）放著
- 活動日有出勤不算缺時已上線 V26.08.03（2026-10-16）。休息日活動不進補休：公司採「原則週休二日、配合活動調休」，
  排班表活動日排「出勤」、調休日排「休假」，缺時只算有排班的日子（computeScheduledStats）
- 寶琳轉 PT **暫緩**（2026-10-19，她自己的決定）：薪資設定已恢復月薪（29,500＋津貼）；PT 契約定稿備在
  ~/Desktop/勞動契約範本-2026-部分工時（PT）.docx（時薪 200、一般班週 3 日原則、時數帳餘額離職月結清），她要轉時再用。
  轉換程序：先把 salarySettings 改 payType hourly、baseSalary＝hourlyRate＝200、津貼 0、payTypeFrom＝生效日、prevSetting＝月薪快照（引擎 effectiveSetting 會讓之前月份照舊）
- **時數帳模式**（2026-10-19，目前只有寶琳）：salarySettings.hoursLedger={from:'2026-09-01',openingHours:13,openingNote}
  → 自 from 起缺時不扣薪，記入時數帳逐月累計（computeCompLedger 回傳 monthly[].ledger{open,opening,add,offsetByComp,close}）；
  補休先抵當月缺時、剩餘再抵餘額；餘額以勞務補足、離職月結清。請假照缺時規則記入（病假／生理假半天 4h、事假與超額病假 8h、特休公假喪假 0；2026-10-20 阿慶確認）。薪資頁與明細自動顯示；9 月明細為手動版（52.52h），10 月起草稿自帶
- 生理假假別：半薪，每月 1 天、全年 3 天內不併入病假（V26.08.07）
- 喪假需選親屬關係（8／6／3 天，Leave.jsx BEREAVEMENT_DAYS），公假全薪不計額度；兩者引擎皆 cat paid
- 已上線 V26.08.02（2026-10-16）：補休抵缺時 9 月起「先加權再抵」（payrollEngine WEIGHTED_OFFSET_FROM）
- 🔴 姿晴 7–8 月缺 72h 分三期（第 1 期 24h、第 2、3 期各 22h（68h 含喪假、生理假後），2026-10-16 雙方約定）：9 月明細已重發第 4 版（本次應領 23,805，含第 1 期扣 2,950；喪假 12h 補入缺 72h；9 月 13 筆上班時間更正為 10:00）；
  **10 月、11 月草稿要各加第 2、3 期**：當期以勞務補足的時數 × 122.92 退還、未補足的扣回（無條件捨去）。
  monthly-drafts 自動草稿不會自己加這段，11/5 後人工補進去再發布（用 ops/publish-statement.mjs）
- Netlify 已升級 Pro（2026-10-16），push main 自動部署恢復；雲端建置若被 secrets scanning 擋，看 netlify.toml 的
  SECRETS_SCAN_* 設定（Firebase web key、VITE_ 金鑰皆為前端公開值）；備援仍可 `npx netlify-cli deploy --prod --dir=dist`
- 10/19–10/25 整週排出勤無休假日（員工自願，阿慶決定不調）；七休一責任在雇主，已告知
