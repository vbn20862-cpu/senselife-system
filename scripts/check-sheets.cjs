const https = require('https');

function fetchGviz(id, gid) {
  return new Promise((resolve, reject) => {
    const url = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:json&gid=' + gid;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseGviz(text) {
  try {
    const json = text.replace(/^[^{]+/, '').replace(/\);\s*$/, '');
    const d = JSON.parse(json);
    const cols = d.table.cols.map(c => c.label);
    const rows = (d.table.rows || []).map(row => row.c.map(cell => {
      if (!cell || cell.v === null || cell.v === undefined) return '';
      if (typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
        const p = cell.v.match(/Date\((\d+),(\d+),(\d+)/);
        if (p) return p[1] + '/' + String(Number(p[2])+1).padStart(2,'0') + '/' + String(p[3]).padStart(2,'0');
      }
      return cell.f !== undefined ? cell.f : cell.v;
    })).filter(r => r.some(v => v !== ''));
    return { cols, rows };
  } catch(e) {
    return { cols: [], rows: [], error: e.message };
  }
}

async function main() {
  // 帳目試其他 gid
  const sheets = [
    ['fKGz gid=925530795', '1fKGzaEbVvzmBZHt5Kr7mwmQDk5G-uOAjx4b2SxWX0rk', '925530795'],
    // 出納登錄其他可能的 gid
    ['1p62 gid=1', '1p62ifua-ugRbIvJpjCMhYfDioR9MvQeBTpn9CCVXSUc', '1'],
    ['1p62 gid=2', '1p62ifua-ugRbIvJpjCMhYfDioR9MvQeBTpn9CCVXSUc', '2'],
    ['1p62 gid=500000000', '1p62ifua-ugRbIvJpjCMhYfDioR9MvQeBTpn9CCVXSUc', '500000000'],
  ];

  for (const [label, id, gid] of sheets) {
    const raw = await fetchGviz(id, gid);
    const d = parseGviz(raw);
    if (d.error || d.rows.length === 0) {
      console.log(label, '-> 無資料 or error:', d.error || '');
    } else {
      console.log('\n=== ' + label);
      console.log('cols:', JSON.stringify(d.cols));
      d.rows.slice(0, 8).forEach((r, i) => console.log(i, JSON.stringify(r)));
    }
  }
}
main().catch(console.error);
