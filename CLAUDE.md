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
- 停班（颱風/豪雨）：沒出勤＝無薪但**不算曠職**；部分停班整塊計
- 時薪制時數＝實際打卡＋已核准有薪假折算（全薪8h/病假4h/事假0）＋加班；**不以排班補足**
- 病假：年度上限內半薪（2026 年 12 天、之後 30 天，整年累計含 9 月前），超過仍可請但無薪；
  事假一年 14 天僅提示，超過仍可請
- 特休按日曆天扣（含排休日），阿慶確認正確，勿改
- **不再產生月底薪資單**（2026-09 拔除）：員工頁與管理員頁的實領都是 `buildDraftSlips` 即時計算，勿另寫一套；
  舊的 `/appData/payrolls` 歷史資料保留在資料庫、僅 Excel 匯出會帶出
- 休息扣除：每連續段照勞基法 §35（>4h 扣 30 分、>8h 扣 60 分、>12h 扣 90 分）
- **活動日**（排班表「活動備註」有填，阿慶統一登打）2026/9/1 起：照登打時間全算——不扣休息、不設 8h 上限，
  超過 8h 仍算正常工時（不轉補休／加班；另打加班卡才算加班）。`salaryCalc.normalDayMinutes`／`ACTIVITY_RAW_FROM`
- 員工排班：當月 1–5 號可自編，之後鎖定僅管理員
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

管理員 `admin`／員工帳號見 `/accounts`（明文，待改雜湊）。員工登入靠
`accounts.name === employees.name` 對應，改名要兩邊同步。

## 待辦（跨 session 交接）

- 🔴 Firebase 安全規則鎖定＋密碼雜湊（最大洞）
- 案件駕駛艙：案件→階段(里程碑)→交辦，已拍板「委託案五階段」範本；
  三個執行中案件的階段設定還在等阿慶回覆
- 小彥機器人：請假送出通知老闆群（等 webhook）、每日健檢推播（本檔上面）
- npm audit 14 個漏洞待升級
