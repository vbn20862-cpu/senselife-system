// 薪資明細草稿核心（純計算，不讀寫檔案、不連網）：CLI（ops/monthly-statements.mjs）與 Netlify 排程函式共用
// 數字全部來自系統薪資引擎（src/utils），與薪資頁一致。函式內不縮排：html 樣板字串照原樣輸出
export function defaultTargetMonth(now = new Date()) {
  const d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toLocaleDateString('sv-SE').slice(0, 7)
}

// raw：/appData 原始資料；SC/PE/HO：salaryCalc / payrollEngine / holidays 模組
export function buildStatements({ raw, target, SC, PE, HO }) {
const [YR, MO] = target.split('-').map(Number)
const results = []
const arr = v => Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {})
const data = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, (v && typeof v === 'object' && !['scheduleNotes', 'suspensions'].includes(k)) ? arr(v) : v]))
const pad = n => String(n).padStart(2, '0'), r2 = n => Math.round(n * 100) / 100
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
const money = n => `NT$ ${Math.round(n).toLocaleString('en-US')}`
const SH = { '出勤': 8, 'W': 8, '上午班': 4, '下午班': 4 }
const hol = new Map(HO.getHolidays(data).map(h => [h.date, h.name]))
const susp = data.suspensions || {}

// 應上班時數＝行政機關辦公時數 − 平日停班時數（全天 8h；部分停班以 fromTime 到 18:00 計）
const govt = SC.GOVT_WORK_DAYS[target]?.hours ?? 0
const suspDays = Object.entries(susp).filter(([d]) => d.startsWith(target) && ![0, 6].includes(new Date(d + 'T00:00').getDay()) && !hol.has(d))
const suspH = suspDays.reduce((a, [, s]) => { if (s.scope === 'full' || !s.fromTime) return a + 8; const [h, m] = s.fromTime.split(':').map(Number); return a + Math.max(0, Math.min(8, 18 - h - (m || 0) / 60)) }, 0)
const expected = govt - suspH

const summary = [`${YR} 年 ${MO} 月薪資明細草稿（產生於 ${new Date().toLocaleString('sv-SE').slice(0, 16)}）`, `應上班時數 ${expected}h（行政機關 ${govt}h${suspH ? ` − 停班 ${suspH}h：${suspDays.map(([d]) => d.slice(5)).join('、')}` : ''}）`, '']

for (const e of data.employees) {
  const s0 = data.salarySettings.find(x => x.empId === e.id); if (!s0) continue
  const s = PE.effectiveSetting(s0, YR, MO)
  const hire = e.hireDate && e.hireDate > `${target}-31` ; if (hire) continue
  const hourly = (s.payType || 'monthly') === 'hourly'
  const recs = data.clockins.filter(c => c.date?.startsWith(target) && c.empName === e.name)
  const ot = {}; for (const sp of SC.computeOTSpans(recs)) if (!sp.missingEnd && !sp.missingStart && sp.startDate) ot[sp.startDate] = (ot[sp.startDate] || 0) + sp.minutes
  const sched = Object.fromEntries(data.schedules.filter(x => x.empId === e.id && x.year === YR && x.month === MO).map(x => [`${target}-${pad(x.day)}`, x.shift]))
  const leaves = d => data.leaveRequests.filter(l => l.empId === e.id && l.status === '已核准' && d >= (l.startDate || l.date) && d <= (l.endDate || l.startDate))
  const L = PE.computeCompLedger(e, data, { year: YR, month: MO }); const tm = L.monthly.find(m => m.year === YR && m.month === MO) || {}
  const defMap = Object.fromEntries((tm.deficitDates || []).map(x => [x.date, x.hours]))
  const dates = [...new Set([...recs.map(c => c.date), ...Object.keys(sched).filter(d => SH[sched[d]])])].sort()
  const rows = dates.map(d => {
    const dr = recs.filter(c => c.date === d).sort((a, b) => a.time.localeCompare(b.time))
    const pick = t => dr.filter(c => c.type === t).map(c => c.time + (c.note && /補登|更正|統一/.test(c.note) ? '*' : '')).join('/')
    const nm = SC.normalDayMinutes(dr, d, data), om = (ot[d] || 0) + SC.activityExtraOTMinutes(dr, d, data), lv = leaves(d)
    const lvH = Math.min(SH[sched[d]] || 0, lv.reduce((a, l) => a + ((l.startDate === l.endDate && Number(l.days) === 0.5) ? 4 : 8), 0))
    const hasIn = dr.some(c => c.type === '上班'), hasOut = dr.some(c => c.type === '下班')
    const flag = !dr.length ? (lv.length ? '' : '無打卡') : (hasIn && !hasOut) ? '缺下班卡' : (!hasIn && hasOut) ? '缺上班卡' : ''
    return { d: `${MO}/${Number(d.slice(8))}`, w: '日一二三四五六'[new Date(d + 'T00:00').getDay()], s: sched[d] || '-', in: pick('上班'), out: pick('下班'),
      h: r2(nm / 60), ot: r2(om / 60), cnt: SC.roundHours(nm) + SC.roundHours(om), lv: lv.map(l => l.type + ((l.startDate === l.endDate && Number(l.days) === 0.5) ? '半天' : '')).join(','), lvH, def: defMap[d] || 0,
      note: [flag, SC.isActivityDay(d, data) ? '活動日' : '', hol.get(d) || '', susp[d] ? (susp[d].label || '停班') : ''].filter(Boolean).join('、') }
  })
  const act = r2(rows.reduce((a, r) => a + r.cnt, 0)), lvH = rows.reduce((a, r) => a + r.lvH, 0), short = r2(expected - act - lvH)
  const lvBy = t => rows.filter(r => r.lv.startsWith(t)).reduce((a, r) => a + r.lvH, 0)
  const lvText = ['特休', '補休', '病假', '生理假', '事假', '婚假', '喪假', '公假'].map(t => [t, lvBy(t)]).filter(([, h]) => h).map(([t, h]) => `${t} ${h}h`).join('、')
  const N = k => Number(s[k] || 0)
  const extras = [['伙食', N('mealAllowance')], ['全勤', N('fullAttendanceBonus')], ['活動出勤', N('activityAttendance')]].filter(([, v]) => v)
  const dedItems = [['健保', N('healthInsEmp')], ['勞保', N('laborInsEmp')], ['勞退自提', N('pensionSelf')], ['眷屬健保', N('dependentHealth')], ['匯費', N('wireFee')]].filter(([, v]) => v)
  const ded = dedItems.reduce((a, [, v]) => a + v, 0)
  const hClock = hourly ? SC.computeEmpMonthClockHours(e, YR, MO, data, { exact: true }) : 0, hLeave = hourly ? PE.leaveEffectiveHoursInMonth(e, YR, MO, data) : 0, hPrem = hourly ? PE.computeHourlyOTPremiumHours(e, YR, MO, data) : 0
  const hourlyHrs = hourly ? r2(hClock + hLeave + hPrem) : 0
  const base = hourly ? Math.round(hourlyHrs * N('baseSalary') || hourlyHrs * N('hourlyRate')) : N('baseSalary')
  const gross = base + extras.reduce((a, [, v]) => a + v, 0)
  const isQEnd = [3, 6, 9, 12].includes(MO); const settle = isQEnd ? L.settlements.find(x => x.year === YR && x.quarter === Math.ceil(MO / 3)) : null
  const cash = hourly ? 0 : (settle?.amount || 0), annual = MO === 12 ? PE.annualLeavePayout(e, YR, data).amount : 0
  const holPrem = hourly ? PE.computeHourlyHolidayPremium(e, YR, MO, data, N('baseSalary') || N('hourlyRate')).amount : 0
  const dock = hourly ? 0 : (tm.dockAmount || 0)
  const net = gross + cash + annual + holPrem - ded - dock
  const rateTxt = r2(L.hourlyRate)

  const pay = [
    [hourly ? `時薪 ${N('baseSalary') || N('hourlyRate')} × ${hourlyHrs} 小時（打卡 ${r2(hClock)}＋有薪假 ${r2(hLeave)}${hPrem ? `＋延長工時加給 ${r2(hPrem)}` : ''}）` : `底薪 ${base.toLocaleString()}${extras.length ? '＋' + extras.map(([k, v]) => `${k} ${v}`).join('＋') : ''}`, money(gross), ''],
    ...(cash ? [[`補休季底折現（Q${Math.ceil(MO / 3)} 未休 ${settle.hours} 小時）`, money(cash), '']] : []),
    ...(annual ? [['特休年底折現', money(annual), '']] : []),
    ...(holPrem ? [['國定假日加給', money(holPrem), '']] : []),
    ...(ded ? [[dedItems.map(([k, v]) => `${k} ${v}`).join('、'), '－ ' + money(ded), '']] : []),
    ...(!hourly ? (tm.ledgerOn
      ? [[`缺時扣薪（經雙方商議協商，自 ${Number(s0.hoursLedger.from.slice(0, 4))} 年 ${Number(s0.hoursLedger.from.slice(5, 7))} 月起缺時不扣薪，改記入下方「時數帳」逐月累計）`, 'NT$ 0', '']]
      : [[`缺時扣薪：${tm.dockHours || 0} 小時 × 時薪 ${rateTxt}（${gross.toLocaleString()} ÷ 240）${tm.consumed ? (tm.weightedOffset ? `（已先用補休 ${tm.consumedHours} 小時依費率加權抵 ${tm.consumed} 小時）` : `（已先用補休抵 ${tm.consumed} 小時）`) : ''}`, dock ? '－ ' + money(dock) : 'NT$ 0', 'miss']]) : []),
  ]
  const LG = tm.ledgerOn ? tm.ledger : null
  const ledgerHtml = LG ? `<h3>時數帳（${Number(s0.hoursLedger.from.slice(0, 4))} 年 ${Number(s0.hoursLedger.from.slice(5, 7))} 月起累計）</h3>
<table class="sum"><tr><th>項目</th><th>時數</th><th>說明</th></tr>
<tr><td>期初餘額</td><td>${LG.open ? `欠公司 ${LG.open} 小時` : '0 小時'}</td><td>上月結轉</td></tr>
${LG.opening ? `<tr><td>期初補計（欠公司）</td><td class="miss">＋ ${LG.opening} 小時</td><td>${esc(LG.openingNote || '')}</td></tr>` : ''}
<tr><td>本月缺時（欠公司）</td><td class="miss">＋ ${LG.add} 小時</td><td>排班應到 − 實際 − 請假折抵${tm.consumed ? `（已先以補休 ${tm.consumedHours} 小時加權抵 ${tm.consumed} 小時）` : ''}</td></tr>
<tr><td>補休抵扣餘額（公司欠你）</td><td>－ ${LG.offsetByComp} 小時</td><td>${LG.offsetHours ? `補休 ${LG.offsetHours} 小時依費率加權` : '本月無剩餘補休可抵'}</td></tr>
<tr class="tot"><td>月底餘額</td><td class="miss">欠公司 ${LG.close} 小時</td><td>折算參考：${LG.close} × ${LG.rate} ＝ ${money(Math.round(LG.close * LG.rate))}</td></tr></table>
<div class="note"><div>・時數帳：每月缺時不扣薪，記入時數帳；當月超過應上班時數的部分（含加班）先抵餘額，餘額逐月往下累計。餘額以後續勞務補足；未補足的餘額於離職月份依當時時薪一併結清。</div></div>` : ''
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${e.name} ${MO} 月工時統計</title><style>
@page{size:A4;margin:12mm 15mm}body{font-family:"PingFang TC","Microsoft JhengHei",sans-serif;color:#2c1a0e;font-size:10pt}
h1{font-size:16pt;margin:0 0 2px}.date{color:#7a6a56;font-size:9pt;margin-bottom:10px}h3{font-size:11.5pt;margin:12px 0 5px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #8a7a66;padding:3px 7px}th{background:#ede5d8}
.sum td:not(:first-child){text-align:right}.miss{color:#b42318;font-weight:700}.tot td{background:#f7f2ea;font-weight:700}
.note{color:#5a4a3a;font-size:8.8pt;margin-top:10px}.note div{margin:2px 0}
h2{font-size:13pt;margin:0 0 8px;break-before:page}.d{font-size:8.3pt}.d td,.d th{padding:3px 4px;text-align:center}.d td.n{text-align:right}.d td.l{text-align:left}.bad td{background:#fbedea;color:#b42318}.lv td{background:#f3f0fa}
</style></head><body>
<h1>${esc(e.name)}　${YR} 年 ${MO} 月工時統計</h1><div class="date">製表日期：${new Date().toLocaleDateString('sv-SE').replace(/-/g, ' / ')}</div>
<table class="sum"><tr><th>項目</th><th>時數</th></tr>
<tr><td>應上班時數（行政機關辦公${suspH ? `，扣除停班 ${suspH} 小時` : ''}）</td><td>${expected} 小時</td></tr>
<tr><td>實際上班時數${Object.values(ot).some(Boolean) ? `（含加班 ${r2(rows.reduce((a, r) => a + Math.floor(r.ot * 2) / 2, 0))} 小時）` : ''}</td><td>${act} 小時</td></tr>
<tr><td>請假時數${lvText ? `（${lvText}）` : ''}</td><td>${lvH} 小時</td></tr>
<tr class="tot"><td>缺少時數（應上 − 實際 − 請假）</td><td class="miss">${short} 小時</td></tr></table>
<h3>薪資計算（系統）</h3>
<table class="sum"><tr><th>項目</th><th>金額</th></tr>
${pay.map(([k, v, c]) => `<tr><td>${esc(k)}</td><td${c ? ` class="${c}"` : ''}>${v}</td></tr>`).join('')}
<tr class="tot"><td>實領</td><td>${money(net)}</td></tr></table>
${ledgerHtml}
<div class="note"><b>說明</b>
<div>・實際上班時數：系統打卡紀錄（時間後標 * 者為補登或更正）。一般日依勞基法第 35 條扣休息、正常工時每日上限 8 小時；活動日照登打時間全算。計入時數＝正常工時與加班各取至 0.5 小時後相加。</div>
${hourly ? '<div>・時薪制（部分工時）：（實際打卡時數按分鐘計［含加班 ×1.0］＋有薪假依當日排班時數折算＋當日超過 8 小時部分之加給：前 2 小時 ×0.34、之後 ×0.67）× 時薪；國定假日有排班出勤者加倍。</div>' : `<div>・系統缺時（扣薪基準）＝排班應到時數 − 實際工時（當日加班先補當日缺時）− 請假折抵；特休全額、病假一半、事假不折抵。本月系統缺時 ${tm.deficitHours || 0} 小時，先用補休抵，不足才扣薪。</div>`}
${(tm.missingPunchDates || []).length ? `<div>・待補登（缺下班卡，尚未計入）：${tm.missingPunchDates.map(d => `${MO}/${Number(d.slice(8))}`).join('、')}。</div>` : ''}
</div>
<h2>逐日明細｜${YR} 年 ${MO} 月</h2><table class="d"><tr><th>日期</th><th>星期</th><th>排班</th><th>上班</th><th>下班</th><th>當日工時</th><th>加班</th><th>計入時數</th><th>請假</th><th>系統缺時</th><th>備註</th></tr>
${rows.map(r => `<tr${r.note.includes('無打卡') ? ' class="bad"' : r.lv ? ' class="lv"' : ''}><td>${r.d}</td><td>${r.w}</td><td>${r.s}</td><td>${esc(r.in) || '—'}</td><td>${esc(r.out) || '—'}</td><td class="n">${r.h || 0}</td><td class="n">${r.ot || ''}</td><td class="n">${r.cnt}</td><td>${r.lv ? r.lv + ' ' + r.lvH + 'h' : ''}</td><td class="n">${r.def || ''}</td><td class="l">${esc(r.note)}</td></tr>`).join('')}
<tr class="tot"><td>小計</td><td></td><td></td><td></td><td></td><td></td><td></td><td class="n">${act}</td><td>${lvH}h</td><td class="n">${tm.deficitHours || 0}</td><td class="l">應上 ${expected}h｜缺 ${short}h</td></tr></table>
</body></html>`
  const alerts = [rows.filter(r => r.note.includes('無打卡')).length && `無打卡 ${rows.filter(r => r.note.includes('無打卡')).map(r => r.d).join('、')}`, (tm.missingPunchDates || []).length && `待補登 ${tm.missingPunchDates.length} 天`].filter(Boolean)
  const line = `${e.name}｜實際 ${act}h、請假 ${lvH}h、缺 ${short}h｜系統缺時 ${tm.deficitHours || 0}h 扣 ${dock.toLocaleString()}｜實領 ${Math.round(net).toLocaleString()}${alerts.length ? '｜⚠ ' + alerts.join('；') : ''}`
  summary.push(line)
  results.push({ emp: { id: e.id, name: e.name }, html, net: Math.round(net), line })
}
return { results, summary }
}
