#!/usr/bin/env node
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'public', 'data', 'pension.json');

// 연금복권 720+: 2011-09-01 첫 추첨, 매주 목요일
function getCurrentPensionRound() {
  const start = new Date('2011-09-01T20:00:00+09:00');
  return Math.max(1, Math.floor((Date.now() - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function parsePensionResults(text) {
  const results = [];
  const blocks = text.split(/제\s*(\d+)회\s*추첨\s*결과/);
  for (let i = 1; i < blocks.length; i += 2) {
    const drwNo = parseInt(blocks[i]);
    const body = blocks[i + 1] || '';

    const dateMatch = body.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (!dateMatch) continue;
    const drwNoDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

    // 조: "X\n조\n" 패턴에서 X 추출
    const groupMatch = body.match(/(\d)\n조\n/);
    if (!groupMatch) continue;
    const group = parseInt(groupMatch[1]);

    // 조 이후 6개 단일 숫자 줄 → 메인 번호
    const afterGroup = body.substring(body.indexOf(groupMatch[0]) + groupMatch[0].length);
    const mainNums = [];
    const lines = afterGroup.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (/^\d$/.test(t)) {
        mainNums.push(t);
        if (mainNums.length === 6) break;
      } else if (t === '보너스') break;
    }
    if (mainNums.length < 6) continue;
    const nums = mainNums.join('');

    // 보너스: "각조" 이후 6개 단일 숫자 줄
    const afterBonus = body.substring(body.indexOf('각조\n'));
    const bonusNums = [];
    const bonusLines = afterBonus.split('\n').slice(2); // skip "각조" and blank
    for (const line of bonusLines) {
      const t = line.trim();
      if (/^\d$/.test(t)) {
        bonusNums.push(t);
        if (bonusNums.length === 6) break;
      } else if (bonusNums.length === 0 && t === '') continue;
      else if (bonusNums.length > 0 && t === '') break;
    }
    if (bonusNums.length < 6) continue;
    const bnusNums = bonusNums.join('');

    results.push({ drwNo, drwNoDate, group, nums, bnusNums });
  }
  return results;
}

async function selectRound(page, round) {
  await page.evaluate(() => {
    const trigger = document.querySelector('button.d-trigger');
    if (trigger) trigger.click();
  });
  await page.waitForTimeout(300);

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
  // 기존 데이터 로드
  let existing = [];
  if (fs.existsSync(DATA_PATH)) {
    existing = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  }
  existing.sort((a, b) => b.drwNo - a.drwNo);

  const currentRound = getCurrentPensionRound();
  const storedNos = new Set(existing.map(d => d.drwNo));

  const missing = [];
  for (let r = 1; r <= currentRound; r++) {
    if (!storedNos.has(r)) missing.push(r);
  }

  console.log(`✅ 현재 저장: ${storedNos.size}개 회차 (최신: ${existing[0]?.drwNo ?? '-'}회)`);
  console.log(`🎯 현재 추정 최신: ${currentRound}회차`);
  console.log(`📥 누락 회차: ${missing.length}개 (${missing[0] ?? '-'} ~ ${missing[missing.length - 1] ?? '-'})\n`);

  if (missing.length === 0) { console.log('이미 최신 상태입니다.'); return; }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://www.dhlottery.co.kr/pt720/result', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  const collected = new Map();

  // 페이지가 선택 회차 기준 약 3회차를 표시하므로 3회차씩 건너뜀
  const targets = [];
  for (let i = missing.length - 1; i >= 0; i -= 3) targets.push(missing[i]);

  console.log(`총 ${targets.length}번 클릭으로 누락 ${missing.length}개 회차 수집 예정\n`);

  // 초기 페이지 파싱 (기본 표시 회차 수집)
  {
    const text = await page.evaluate(() => document.body.innerText);
    const parsed = parsePensionResults(text).filter(e => !storedNos.has(e.drwNo));
    parsed.forEach(e => collected.set(e.drwNo, e));
    if (parsed.length > 0) {
      console.log(`[초기] 파싱: ${parsed.map(p => p.drwNo).join(', ')} (누적 ${collected.size}개)`);
    }
  }

  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    // 이미 수집된 회차는 건너뜀
    if (collected.has(r) && (r === 1 || collected.has(r - 1) || collected.has(r - 2))) continue;

    process.stdout.write(`[${i + 1}/${targets.length}] ${r}회 선택 → `);

    const ok = await selectRound(page, r);
    if (!ok) {
      console.log('버튼 없음, 건너뜀');
      continue;
    }

    const text = await page.evaluate(() => document.body.innerText);
    const parsed = parsePensionResults(text).filter(e => !storedNos.has(e.drwNo));

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
}

main().catch(console.error);
