// 共用：Firebase REST 讀寫（UTF-8 安全）
import https from 'node:https'

export const DB = 'https://senselifemaker-default-rtdb.firebaseio.com'

export function fbGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`${DB}${path}`, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

export function fbWrite(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(new URL(`${DB}${path}`), {
      method, headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const s = Buffer.concat(chunks).toString('utf8')
        res.statusCode < 300 ? resolve(s ? JSON.parse(s) : null) : reject(new Error(`HTTP ${res.statusCode}: ${s.slice(0, 200)}`))
      })
    })
    req.on('error', reject)
    if (body != null) req.write(Buffer.from(JSON.stringify(body), 'utf8'))
    req.end()
  })
}

export const arr = v => Array.isArray(v) ? v.filter(x => x != null) : Object.values(v || {})
export const todayStr = () => new Date().toLocaleDateString('sv-SE')
