// Netlify Serverless Function: 동행복권 API 프록시
const http = require('http');
const https = require('https');

// 세션 쿠키를 받아온 후 API 호출
function getSessionCookie() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.dhlottery.co.kr',
      path: '/',
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    }, (res) => {
      const cookies = (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
      res.resume(); // drain
      res.on('end', () => resolve(cookies));
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
    req.end();
  });
}

function fetchLotto(round, cookie) {
  return new Promise((resolve) => {
    // HTTPS 시도
    function tryFetch(protocol, hostname, port) {
      const mod = protocol === 'https' ? https : http;
      const req = mod.request({
        hostname,
        port,
        path: `/common.do?method=getLottoNumber&drwNo=${round}`,
        method: 'GET',
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': 'https://www.dhlottery.co.kr/gameResult.do?method=byWin',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookie || '',
        },
      }, (res) => {
        // 리다이렉트면 실패 처리
        if (res.statusCode >= 300 && res.statusCode < 400) {
          res.resume();
          res.on('end', () => resolve(null));
          return;
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.returnValue === 'success') resolve(json);
            else resolve(null);
          } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    }

    tryFetch('https', 'www.dhlottery.co.kr', 443);
  });
}

function getCurrentRound() {
  const start = new Date('2002-12-07T18:00:00+09:00');
  const now = new Date();
  return Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Content-Type': 'application/json; charset=utf-8',
  };

  const params = event.queryStringParameters || {};
  const { action, round, count } = params;

  try {
    // 세션 쿠키 획득
    const cookie = await getSessionCookie();

    if (action === 'debug') {
      const r = parseInt(round) || 1100;
      const result = await fetchLotto(r, cookie);
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ round: r, hasCookie: !!cookie, cookie: cookie.substring(0, 80), result }),
      };
    }

    if (action === 'fetch') {
      const r = parseInt(round);
      if (!r || r < 1) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid round' }) };
      const result = await fetchLotto(r, cookie);
      return { statusCode: 200, headers, body: JSON.stringify(result || { returnValue: 'fail' }) };
    }

    if (action === 'bulk') {
      const n = Math.min(parseInt(count) || 50, 100);
      let latest = getCurrentRound();

      // 최신 회차 찾기
      let test = await fetchLotto(latest, cookie);
      if (!test) { latest--; test = await fetchLotto(latest, cookie); }
      if (!test) { latest--; test = await fetchLotto(latest, cookie); }
      if (!test) {
        return { statusCode: 200, headers, body: JSON.stringify({ results: [], latestRound: latest, error: 'API unavailable' }) };
      }

      // 병렬 요청
      const promises = [Promise.resolve(test)];
      for (let i = 1; i < n; i++) {
        promises.push(fetchLotto(latest - i, cookie));
      }
      const all = await Promise.all(promises);
      const results = all.filter(Boolean);

      return { statusCode: 200, headers, body: JSON.stringify({ results, latestRound: latest }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Use: fetch, bulk, debug' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
