# 自動打卡腳本部署說明

## 檔案
- `auto-clockin-standalone.mjs` — 單檔執行，**零 npm 依賴**，只需 Node.js 18+

## 邏輯（跟你原本的一樣）
- 上班 09:00–09:30 隨機
- 下班 = 上班 + 9 小時 + 0–60 分鐘隨機
- 只在排班表標記「出勤」的日子打卡
- 同日已打過就跳過（idempotent，可重複執行）

## 部署到不會關機的電腦

### 步驟 1：裝 Node.js
到 <https://nodejs.org/zh-tw/> 下載 LTS 版本裝起來。

驗證：
```
node --version
```
要顯示 v18.0.0 以上。

### 步驟 2：放檔案
把 `auto-clockin-standalone.mjs` 放到電腦任一資料夾，例如：
- Mac：`/Users/你的帳號/clock-bot/auto-clockin-standalone.mjs`
- Windows：`C:\clock-bot\auto-clockin-standalone.mjs`

### 步驟 3：手動測試
先手動跑一次確認可以運作：
```
node auto-clockin-standalone.mjs
```

看到下面訊息代表成功：
```
🕐 林家慶自動打卡系統
========================================
📅 單日模式：2026-04-23
📝 需要打卡 1 天：
  2026-04-23  09:12 → 18:37
✅ 成功寫入 2 筆打卡紀錄！
```

### 步驟 4：設定排程

#### Mac / Linux（crontab）

```bash
crontab -e
```

加入兩行（週一～五，早上 9:35 打上班、下午 18:30 打下班）：
```
35 9  * * 1-5 /usr/local/bin/node /Users/你的帳號/clock-bot/auto-clockin-standalone.mjs >> /Users/你的帳號/clock-bot/clockin.log 2>&1
30 18 * * 1-5 /usr/local/bin/node /Users/你的帳號/clock-bot/auto-clockin-standalone.mjs >> /Users/你的帳號/clock-bot/clockin.log 2>&1
```

`which node` 查 node 的絕對路徑，貼在 `/usr/local/bin/node` 的位置。

#### Windows（工作排程器）

1. 開「工作排程器」→ 建立基本工作
2. 觸發程序：每天 09:35（再建一個 18:30）
3. 動作：啟動程式
4. 程式：`node`（若找不到就填完整路徑如 `C:\Program Files\nodejs\node.exe`）
5. 引數：`C:\clock-bot\auto-clockin-standalone.mjs`
6. 起始位置：`C:\clock-bot`

## 重要前提

**排班表必須先設好**才會打卡！

系統邏輯是：只有在排班表標記「出勤」的日子才會自動打卡。
所以你要先到**人事管理 → 排班**那邊，把每月的出勤日標好。

如果當天不是出勤日（例如休假、補休、請假），腳本會直接跳過。

## 特殊模式

```
# 補打整個月（4 月初還沒跑，5 月才部署，可以補打 4 月的）
node auto-clockin-standalone.mjs --month

# 修正已有紀錄（下班時間剛好 +9 小時的，改成加上隨機浮動 0-60 分）
node auto-clockin-standalone.mjs --fix-hours
```

## 疑難排解

**「無法讀取 Firebase 資料」**
- 網路不通
- Firebase 暫時故障（等幾分鐘再試）

**「今天不是出勤日」但其實是出勤日**
- 去系統的人事管理 → 排班，確認該員工該日是「出勤 / W」而不是空白或「休」

**重複執行會不會打兩次？**
- 不會，腳本會檢查是否已有同日紀錄，跳過

## 想加其他員工

改檔案最上方的設定：
```javascript
const EMP_ID = 1              // 改成目標員工 ID
const EMP_NAME = '林家慶'      // 改成目標員工姓名
const NAME_ALIASES = [...]    // 判斷「已打卡」時比對的所有名字（含暱稱）
```

多人的話，複製成多個檔案，各自改設定、各自排程。
