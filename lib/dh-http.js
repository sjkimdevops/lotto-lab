// 동행복권 신규 사이트(.do JSON 엔드포인트) 공용 HTTP 헬퍼
const https = require('https');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 성공 시 파싱된 JSON, 실패 시 null. HTML(로그인/에러 페이지)이 오면 null 취급.
function getJsonOnce(path, referer) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.dhlottery.co.kr',
      path,
      method: 'GET',
      timeout: 15000,
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': referer,
        'X-Requested-With': 'XMLHttpRequest',
      },
    }, (res) => {
      if (res.statusCode >= 300) { res.resume(); res.on('end', () => resolve(null)); return; }
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const t = data.trim();
        if (!t.startsWith('{') && !t.startsWith('[')) { resolve(null); return; }
        try { resolve(JSON.parse(t)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function getJson(path, referer, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const json = await getJsonOnce(path, referer);
    if (json) return json;
    await sleep(500 * (i + 1));
  }
  return null;
}

module.exports = { getJson, sleep };
