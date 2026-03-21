// Netlify Serverless Function: 동행복권 API 프록시
const https = require('https');

function fetchLotto(round) {
  return new Promise((resolve) => {
    const parsed = new URL(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'Referer': 'https://www.dhlottery.co.kr/',
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ returnValue: 'fail', raw: data.substring(0, 200) }); }
      });
    });
    req.on('error', (e) => resolve({ returnValue: 'fail', error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ returnValue: 'fail', error: 'timeout' }); });
    req.end();
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
    // 디버그용: 단일 회차 raw 응답 확인
    if (action === 'debug') {
      const r = parseInt(round) || 1100;
      const result = await fetchLotto(r);
      return { statusCode: 200, headers, body: JSON.stringify({ round: r, result }) };
    }

    if (action === 'latest') {
      let r = getCurrentRound();
      let result = await fetchLotto(r);
      if (result.returnValue !== 'success') {
        r--;
        result = await fetchLotto(r);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ latestRound: result.returnValue === 'success' ? r : r - 1 }) };
    }

    if (action === 'fetch') {
      const r = parseInt(round);
      if (!r || r < 1) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid round' }) };
      const result = await fetchLotto(r);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    if (action === 'bulk') {
      const n = Math.min(parseInt(count) || 50, 100);
      let latest = getCurrentRound();
      let test = await fetchLotto(latest);
      if (test.returnValue !== 'success') {
        latest--;
        test = await fetchLotto(latest);
        if (test.returnValue !== 'success') latest--;
      }

      const promises = [];
      for (let i = 0; i < n; i++) {
        promises.push(fetchLotto(latest - i));
      }
      const all = await Promise.all(promises);
      const results = all.filter(r => r.returnValue === 'success');

      return { statusCode: 200, headers, body: JSON.stringify({ results, latestRound: latest }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: latest, fetch, bulk, debug' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
