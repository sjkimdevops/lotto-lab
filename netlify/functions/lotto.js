// Netlify Serverless Function: 동행복권 API 프록시
const https = require('https');

function fetchLotto(round) {
  return new Promise((resolve, reject) => {
    const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`;
    https.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

function getCurrentRound() {
  const start = new Date('2002-12-07');
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
      if (test.returnValue !== 'success') latest--;

      const results = [];
      const batchSize = 10;
      for (let i = 0; i < n; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, n); j++) {
          batch.push(fetchLotto(latest - j));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.filter(r => r.returnValue === 'success'));
      }
      return { statusCode: 200, headers, body: JSON.stringify({ results, latestRound: latest }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: latest, fetch, bulk' }) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
