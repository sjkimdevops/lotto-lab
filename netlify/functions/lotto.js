// Netlify Serverless Function: 동행복권 API 프록시
const https = require('https');

function fetchLotto(round) {
  return new Promise((resolve) => {
    const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
    const options = {
      timeout: 4000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LottoLab/1.0)',
        'Accept': 'application/json',
      },
    };
    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ returnValue: 'fail' }); }
      });
    });
    req.on('error', () => resolve({ returnValue: 'fail' }));
    req.on('timeout', () => { req.destroy(); resolve({ returnValue: 'fail' }); });
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

      // 전체 병렬 요청
      const promises = [];
      for (let i = 0; i < n; i++) {
        promises.push(fetchLotto(latest - i));
      }
      const all = await Promise.all(promises);
      const results = all.filter(r => r.returnValue === 'success');

      return { statusCode: 200, headers, body: JSON.stringify({ results, latestRound: latest }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: latest, fetch, bulk' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
