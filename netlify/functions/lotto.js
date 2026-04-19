// Netlify Serverless Function: 로또 데이터 API
const https = require('https');
const http = require('http');

// 동행복권 API에서 데이터 가져오기 시도 (한국 IP에서만 동작)
function fetchPensionFromDhlottery(round) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.dhlottery.co.kr',
      path: `/common.do?method=getPension720Result&drwNo=${round}`,
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, */*',
        'Referer': 'https://www.dhlottery.co.kr/gameResult.do?method=byWin&wiseName=720+',
        'X-Requested-With': 'XMLHttpRequest',
      },
    }, (res) => {
      if (res.statusCode >= 300) { res.resume(); res.on('end', () => resolve(null)); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.returnValue === 'success' ? json : null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function fetchFromDhlottery(round) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.dhlottery.co.kr',
      path: `/common.do?method=getLottoNumber&drwNo=${round}`,
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, */*',
        'Referer': 'https://www.dhlottery.co.kr/gameResult.do?method=byWin',
        'X-Requested-With': 'XMLHttpRequest',
      },
    }, (res) => {
      if (res.statusCode >= 300) { res.resume(); res.on('end', () => resolve(null)); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.returnValue === 'success' ? json : null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
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
  const { action, round } = params;

  try {
    if (action === 'fetch') {
      const r = parseInt(round);
      if (!r || r < 1) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid round' }) };
      const result = await fetchFromDhlottery(r);
      return { statusCode: 200, headers, body: JSON.stringify(result || { returnValue: 'fail' }) };
    }

    if (action === 'fetchPension') {
      const r = parseInt(round);
      if (!r || r < 1) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid round' }) };
      const result = await fetchPensionFromDhlottery(r);
      return { statusCode: 200, headers, body: JSON.stringify(result || { returnValue: 'fail' }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Use: fetch, fetchPension' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
