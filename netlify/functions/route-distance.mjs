// 交通費（自用車里程）路線距離：Google Routes API（開車路線），起點→中間點→終點，回傳公尺與「無條件捨去」的公里數
// 優先用地圖金鑰 GOOGLE_MAPS_API_KEY（Netlify 環境變數）；沒有才用日曆同步的服務帳號 OAuth。GCP 專案需啟用 Routes API 並綁定帳單
// POST { origin, waypoints: [...], destination } → { meters, km, legs: [...公尺], mapUrl }
import { accessToken } from '../lib/calendar-sync-core.mjs'

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  let body = {}
  try { body = await req.json() } catch {}
  const clean = s => String(s || '').trim().slice(0, 200)
  const origin = clean(body.origin), destination = clean(body.destination)
  const waypoints = (Array.isArray(body.waypoints) ? body.waypoints : []).map(clean).filter(Boolean).slice(0, 10)
  if (!origin || !destination) return json({ error: '請填起點與終點' }, 400)
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY
    const auth = key ? { 'X-Goog-Api-Key': key } : { Authorization: `Bearer ${await accessToken('https://www.googleapis.com/auth/cloud-platform')}` }
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json', 'X-Goog-FieldMask': 'routes.distanceMeters,routes.legs.distanceMeters' },
      body: JSON.stringify({
        origin: { address: origin }, destination: { address: destination },
        intermediates: waypoints.map(address => ({ address })),
        travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE', languageCode: 'zh-TW', regionCode: 'TW', units: 'METRIC',
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return json({ error: `Google 路線查詢失敗（${res.status}）：${j.error?.message || ''}`.slice(0, 300) }, 502)
    const r = j.routes?.[0]
    if (!r?.distanceMeters) return json({ error: '找不到路線，請把地點寫完整（例：屏東縣瑪家鄉和平路一段65號）' }, 404)
    const enc = encodeURIComponent
    const mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${enc(origin)}&destination=${enc(destination)}${waypoints.length ? `&waypoints=${enc(waypoints.join('|'))}` : ''}&travelmode=driving`
    return json({ meters: r.distanceMeters, km: Math.floor(r.distanceMeters / 1000), legs: (r.legs || []).map(l => l.distanceMeters || 0), mapUrl })
  } catch (err) {
    console.error('[route-distance]', err)
    return json({ error: String(err.message || err).slice(0, 300) }, 500)
  }
}
