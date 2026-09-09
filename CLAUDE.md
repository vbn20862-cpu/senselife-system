# 深活共構管理系統 — Agent 操作手冊

公司內部管理系統（打卡/薪資/請假/交辦/活動/財務）。老闆＝阿慶（林家慶）。
本檔是任何 agent（Claude Code、OpenClaw 機器人）在任何機器上接手本專案的操作依據。

## 架構（事實，已查）

- **前端**：React 18 + Vite，單頁應用，路由在 `src/App.jsx`，選單在 `src/components/Layout.jsx`
- **資料**：Firebase Realtime Database（REST 端點 `https://senselifemaker-default-rtdb.firebaseio.com`）
  - 業務資料在 `/appData`，帳號在 `/accounts`
  - ⚠️ 目前規則全開（未登入可讀寫、密碼明文）——已知風險，待鎖（見待辦）
- **部署**：Netlify `https://senselife-system.netlify.app`
  - 綁 GitHub 自動部署：push `main` = 上線；`netlify.toml` 已設定
  - 手動備援：`npm run build && npx netlify-cli deploy --prod --dir=dist`
- **薪資引擎**：`src/utils/payrollEngine.js`（走法B）＋ `src/utils/salaryCalc.js`

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

- 加班：只有打「加班開始/結束」卡才算；月薪制→超過8h部分轉補休（1.34/1.67，假日×2），
  季底(3/6/9/12月)未休折現；**時薪制→時數×時薪×1.0 直接併薪**，不入補休
- 缺時＝排班應到而少做的時數：先用補休抵，不足才扣薪（時薪 = 經常性給與÷240）
- 停班（颱風/豪雨）：沒出勤＝無薪但**不算曠職**；部分停班整塊計
- 休息扣除：每連續段照勞基法 §35（>4h 扣 30 分、>8h 扣 60 分）
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
