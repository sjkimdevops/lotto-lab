#!/usr/bin/env node
// 로컬(한국 IP)에서 실행해서 lotto.json을 최신 상태로 업데이트합니다.
// 사용법: node update-lotto-data.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'public', 'data', 'lotto.json');

function fetchRound(round) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.dhlottery.co.kr',
      path: `/common.do?method=getLottoNumber&drwNo=${round}`,
      method: 'GET',
      timeout: 8000,
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
  return Math.floor((Date.now() - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('📂 lotto.json 읽는 중...');
  const existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  existing.sort((a, b) => b.drwNo - a.drwNo);
  const latestStored = existing[0].drwNo;
  const currentRound = getCurrentRound();

  console.log(`✅ 현재 저장: ${latestStored}회차`);
  console.log(`🎯 현재 추정 최신: ${currentRound}회차`);
  console.log(`📥 가져올 회차: ${latestStored + 1} ~ ${currentRound} (${currentRound - latestStored}개)\n`);

  if (latestStored >= currentRound) {
    console.log('이미 최신 상태입니다.');
    return;
  }

  const newEntries = [];
  let failCount = 0;

  for (let r = latestStored + 1; r <= currentRound; r++) {
    const result = await fetchRound(r);
    if (result) {
      newEntries.push(result);
      process.stdout.write(`✅ ${r}회차 (${result.drwNoDate})\n`);
      failCount = 0;
    } else {
      process.stdout.write(`⏭️  ${r}회차 미발표 또는 실패\n`);
      failCount++;
      if (failCount >= 3) {
        console.log('\n3회 연속 실패 → 종료');
        break;
      }
    }
    await sleep(300); // 서버 부하 방지
  }

  if (newEntries.length === 0) {
    console.log('\n⚠️  새로 가져온 데이터 없음. 한국 네트워크에서 실행해주세요.');
    return;
  }

  const merged = [...newEntries, ...existing];
  merged.sort((a, b) => b.drwNo - a.drwNo);
  fs.writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2), 'utf-8');

  console.log(`\n🎉 완료! ${newEntries.length}개 회차 추가됨 → 최신: ${merged[0].drwNo}회차 (${merged[0].drwNoDate})`);
  console.log('\n다음 단계:');
  console.log('  git add public/data/lotto.json');
  console.log('  git commit -m "data: 로또 당첨번호 업데이트"');
  console.log('  git push');
}

main().catch(console.error);
