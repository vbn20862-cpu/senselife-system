// 打卡定位相關工具

// 取得目前裝置位置（Promise 包裝 getCurrentPosition）
// 回傳 { lat, lng, accuracy } 或 throw 帶 code 的錯誤
export function getCurrentCoords(opts = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(Object.assign(new Error('此裝置不支援定位'), { code: 'unsupported' }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy),
      }),
      err => {
        // err.code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
        const code = err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'
        reject(Object.assign(new Error(err.message || '定位失敗'), { code }))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000, ...opts }
    )
  })
}

// 反向地理編碼：座標 → 中文地址（使用 BigDataCloud 免費 client 端 API，免金鑰）
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`
    const res = await fetch(url)
    if (!res.ok) return ''
    const j = await res.json()
    // 台灣慣例：縣市 + 鄉鎮市區 + 里/路（盡量組出可讀地址）
    const admin = j.localityInfo?.administrative || []
    const detail = admin.length ? admin[admin.length - 1]?.name : ''
    const parts = [
      j.principalSubdivision,           // 縣市，如「屏東縣」
      j.city || j.locality,             // 鄉鎮市區
      detail && detail !== j.locality ? detail : '',  // 里/區
    ].filter(Boolean)
    // 去重（有時 city 與 locality 重複）
    const uniq = [...new Set(parts)]
    return uniq.join('') || j.locality || j.city || ''
  } catch {
    return ''
  }
}

// 產生 Google Maps 連結
export function mapLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
