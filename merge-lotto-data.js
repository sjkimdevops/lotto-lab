#!/usr/bin/env node
// 브라우저에서 수집한 lotto_new.json을 기존 lotto.json에 병합합니다.
// 사용법: node merge-lotto-data.js ~/Downloads/lotto_new.json

const fs = require('fs');
const path = require('path');

const newFile = process.argv[2];
if (!newFile) {
  console.error('사용법: node merge-lotto-data.js <lotto_new.json 경로>');
  console.error('예시:  node merge-lotto-data.js ~/Downloads/lotto_new.json');
  process.exit(1);
}

const DATA_PATH = path.join(__dirname, 'public', 'data', 'lotto.json');

const existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
const newData  = JSON.parse(fs.readFileSync(path.resolve(newFile.replace(/^~/, process.env.HOME)), 'utf-8'));

const existingNos = new Set(existing.map(d => d.drwNo));
const added = newData.filter(d => !existingNos.has(d.drwNo));

if (added.length === 0) {
  console.log('추가할 새 회차가 없습니다.');
  process.exit(0);
}

const merged = [...added, ...existing];
merged.sort((a, b) => b.drwNo - a.drwNo);

fs.writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2), 'utf-8');
console.log(`✅ ${added.length}개 회차 추가 완료`);
console.log(`   추가 범위: ${added[added.length-1].drwNo}회 ~ ${added[0].drwNo}회`);
console.log(`   최신 데이터: ${merged[0].drwNo}회 (${merged[0].drwNoDate})`);
console.log('\n다음 단계:');
console.log('  git add public/data/lotto.json');
console.log('  git commit -m "data: 로또 당첨번호 업데이트"');
console.log('  git push');
