#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'public', 'data', 'lotto.json');

function getCurrentRound() {
  const start = new Date('2002-12-07T18:00:00+09:00');
  return Math.floor((Date.now() - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

function parseLottoResults(text) {
  const results = [];
  const blocks = text.split(/제\s*(\d+)회\s*추첨\s*결과/);
  for (let i = 1; i < blocks.length; i += 2) {
    const drwNo = parseInt(blocks[i]);
    const body = blocks[i + 1] || '';
    const dateMatch = body.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (!dateMatch) continue;
    const drwNoDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    const nums = (body.match(/\b([1-9]|[1-3][0-9]|4[0-5])\b/g) || []).map(Number).slice(0, 7);
    if (nums.length < 7) continue;
    results.push({
      drwNo, drwNoDate,
      drwtNo1: nums[0], drwtNo2: nums[1], drwtNo3: nums[2],
      drwtNo4: nums[3], drwtNo5: nums[4], drwtNo6: nums[5],
      bnusNo: nums[6],
      returnValue: 'success'
    });
  }
  return results;
}

async function selectRound(page, round) {
  // d-trigger 클릭 → 드롭다운 열기
  await page.evaluate(() => {
    const trigger = document.querySelector('button.d-trigger');
    if (trigger) trigger.click();
  });
  await page.waitForTimeout(300);

  // 해당 회차 option-il 버튼 클릭
  const clicked = await page.evaluate((r) => {
    const btn = [...document.querySelectorAll('button.option-il')]
      .find(b => b.textContent.trim() === `${r}회`);
    if (btn) { btn.click(); return true; }
    return false;
  }, round);

  await page.waitForTimeout(1500);
  return clicked;
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  existing.sort((a, b) => b.drwNo - a.drwNo);
  const latestStored = existing[0].drwNo;
  const currentRound = getCurrentRound();

  // 저장된 회차 집합
  const storedNos = new Set(existing.map(d => d.drwNo));

  // 1회차부터 currentRound까지 누락된 회차 탐색
  const missing = [];
  for (let r = 1; r <= currentRound; r++) {
    if (!storedNos.has(r)) missing.push(r);
  }

  console.log(`✅ 현재 저장: ${storedNos.size}개 회차 (최신: ${latestStored}회)`);
  console.log(`🎯 현재 추정 최신: ${currentRound}회차`);
  console.log(`📥 누락 회차: ${missing.length}개 (${missing[0] ?? '-'} ~ ${missing[missing.length - 1] ?? '-'})\n`);

  if (missing.length === 0) { console.log('이미 최신 상태입니다.'); return; }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.dhlottery.co.kr/lt645/result', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1500);

  const collected = new Map();

  // 누락 회차를 2개씩 묶어 순회 (페이지가 선택 회차 + 이전 회차 표시)
  const targets = [];
  for (let i = missing.length - 1; i >= 0; i -= 2) targets.push(missing[i]);

  console.log(`총 ${targets.length}번 클릭으로 누락 ${missing.length}개 회차 수집 예정\n`);

  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    process.stdout.write(`[${i + 1}/${targets.length}] ${r}회 선택 → `);

    const ok = await selectRound(page, r);
    if (!ok) {
      console.log('버튼 없음, 건너뜀');
      continue;
    }

    const text = await page.evaluate(() => document.body.innerText);
    const parsed = parseLottoResults(text).filter(e => !storedNos.has(e.drwNo));

    parsed.forEach(e => collected.set(e.drwNo, e));
    console.log(`파싱: ${parsed.map(p => p.drwNo).join(', ')} (누적 ${collected.size}개)`);
  }

  await browser.close();

  const newEntries = [...collected.values()];
  if (newEntries.length === 0) {
    console.log('\n⚠️  새 데이터 없음.');
    return;
  }

  const merged = [...newEntries, ...existing].filter((v, i, a) => a.findIndex(x => x.drwNo === v.drwNo) === i);
  merged.sort((a, b) => b.drwNo - a.drwNo);
  fs.writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`\n🎉 완료! ${newEntries.length}개 추가 → 최신: ${merged[0].drwNo}회차 (${merged[0].drwNoDate})`);
  console.log('  git add public/data/lotto.json && git commit -m "data: 로또 당첨번호 업데이트" && git push');
}

main().catch(console.error);
