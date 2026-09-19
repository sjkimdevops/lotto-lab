#!/usr/bin/env node
// 로또 6/45 당첨번호 수집 — 동행복권 신규 사이트 JSON 엔드포인트 사용.
//   GET /lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=N  → N-5 ~ N+4 (10건)
//
// 사용법:
//   node fetch-lotto.js            누락 회차만 추가
//   node fetch-lotto.js --rebuild  1회차부터 전부 다시 받아 검증 후 덮어쓰기
//
// 파싱한 모든 회차는 검증(번호 범위/중복/날짜 연속성)을 통과해야 저장된다.

const fs = require('fs');
const path = require('path');
const { getJson, sleep } = require('./lib/dh-http');

const DATA_PATH = path.join(__dirname, 'public', 'data', 'lotto.json');
const REFERER = 'https://www.dhlottery.co.kr/lt645/result';
const WINDOW_BACK = 5;   // 응답은 요청 회차 기준 뒤로 5, 앞으로 4
const WINDOW_FWD = 4;

// 서버가 5회차 미만 / 최신-3회차 초과를 거부하므로 요청 회차를 이 범위로 고정한다.
function clampCenter(c, latest) {
  const hi = latest ? latest - WINDOW_FWD : Infinity;
  return Math.max(WINDOW_BACK + 1, Math.min(c, hi));
}

function toEntry(o) {
  const ymd = String(o.ltRflYmd || '');
  if (!/^\d{8}$/.test(ymd)) return null;
  return {
    drwNo: Number(o.ltEpsd),
    drwNoDate: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}`,
    drwtNo1: Number(o.tm1WnNo), drwtNo2: Number(o.tm2WnNo), drwtNo3: Number(o.tm3WnNo),
    drwtNo4: Number(o.tm4WnNo), drwtNo5: Number(o.tm5WnNo), drwtNo6: Number(o.tm6WnNo),
    bnusNo: Number(o.bnsWnNo),
    returnValue: 'success',
  };
}

async function fetchWindow(center) {
  const json = await getJson(
    `/lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=${center}`, REFERER);
  const list = json && json.data && json.data.list;
  if (!Array.isArray(list)) return [];
  return list.map(toEntry).filter(Boolean);
}

// 회차 1건 검증
function validateEntry(e) {
  const errs = [];
  const nums = [e.drwtNo1, e.drwtNo2, e.drwtNo3, e.drwtNo4, e.drwtNo5, e.drwtNo6];
  if (!Number.isInteger(e.drwNo) || e.drwNo < 1) errs.push('회차 번호 이상');
  if (nums.some(n => !Number.isInteger(n) || n < 1 || n > 45)) errs.push('본번호 범위 이탈');
  if (new Set(nums).size !== 6) errs.push('본번호 중복');
  if (!Number.isInteger(e.bnusNo) || e.bnusNo < 1 || e.bnusNo > 45) errs.push('보너스 범위 이탈');
  if (nums.includes(e.bnusNo)) errs.push('보너스가 본번호와 중복');
  const d = new Date(`${e.drwNoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) errs.push('날짜 파싱 실패');
  else if (d.getUTCDay() !== 6) errs.push(`추첨일이 토요일이 아님(${e.drwNoDate})`);
  return errs;
}

// 전체 시리즈 검증: 회차 연속성 + 7일 간격
function validateSeries(list) {
  const errs = [];
  const sorted = [...list].sort((a, b) => a.drwNo - b.drwNo);
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    validateEntry(e).forEach(m => errs.push(`${e.drwNo}회: ${m}`));
    if (i > 0) {
      const prev = sorted[i - 1];
      if (e.drwNo !== prev.drwNo + 1) errs.push(`${prev.drwNo}회 → ${e.drwNo}회: 회차 누락`);
      const gap = (new Date(`${e.drwNoDate}T00:00:00Z`) - new Date(`${prev.drwNoDate}T00:00:00Z`)) / 86400000;
      if (gap !== 7) errs.push(`${prev.drwNo}회 → ${e.drwNo}회: 추첨 간격 ${gap}일 (7일 아님)`);
    }
  }
  return errs;
}

async function main() {
  const rebuild = process.argv.includes('--rebuild');
  const existing = fs.existsSync(DATA_PATH)
    ? JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')) : [];
  const stored = new Map(existing.map(e => [e.drwNo, e]));

  // 1) 최신 회차 확인 — 날짜로 추정한 뒤 실제 응답으로 보정한다.
  //    (서버는 (최신-3)회차를 넘는 요청을 거부하므로 빈 응답 = 아직 발표 전)
  const FIRST_DRAW = Date.UTC(2002, 11, 7);
  const estimate = Math.floor((Date.now() - FIRST_DRAW) / (7 * 86400000)) + 1;

  let latest = 0;
  for (let c = estimate; c >= WINDOW_BACK + 1 && !latest; c -= WINDOW_FWD + 1) {
    for (const e of await fetchWindow(c)) latest = Math.max(latest, e.drwNo);
    if (!latest) await sleep(150);
  }
  if (!latest) {
    console.error('❌ 엔드포인트에서 데이터를 받지 못했습니다. (네트워크 또는 사이트 구조 변경 확인)');
    process.exit(1);
  }
  // 추정이 낮았을 경우를 대비해 위쪽으로 한 번 더 민다.
  for (let step = 0; step < 20; step++) {
    const max = (await fetchWindow(latest + WINDOW_BACK))
      .reduce((m, e) => Math.max(m, e.drwNo), 0);
    if (max <= latest) break;
    latest = max;
    await sleep(150);
  }

  const storedLatest = existing.length ? Math.max(...stored.keys()) : 0;
  console.log(`✅ 저장됨: ${existing.length}개 회차 (최신 ${storedLatest || '-'}회)`);
  console.log(`🎯 사이트 최신: ${latest}회`);

  // 2) 받아야 할 회차 목록
  const need = new Set();
  for (let r = 1; r <= latest; r++) {
    if (rebuild || !stored.has(r)) need.add(r);
  }
  if (need.size === 0) {
    console.log('이미 최신 상태입니다.');
    return;
  }
  console.log(`📥 수집 대상: ${need.size}개 회차${rebuild ? ' (전체 재수집)' : ''}\n`);

  // 3) 창(window) 단위로 수집 — 빈 곳이 없어질 때까지 반복
  const collected = new Map();
  let guard = 0;
  while (guard++ < 400) {
    const missing = [...need].filter(r => !collected.has(r)).sort((a, b) => a - b);
    if (missing.length === 0) break;
    const center = clampCenter(missing[0] + WINDOW_BACK, latest);
    const before = collected.size;
    for (const e of await fetchWindow(center)) collected.set(e.drwNo, e);
    if (collected.size === before) {
      console.error(`❌ ${center}회 요청에서 새 데이터를 얻지 못했습니다. (남은 ${missing.length}개)`);
      process.exit(1);
    }
    process.stdout.write(`\r수집 ${collected.size}/${need.size}`);
    await sleep(200);
  }
  console.log('');

  // 4) 병합 + 검증
  const merged = new Map(rebuild ? [] : stored);
  for (const [no, e] of collected) merged.set(no, e);
  const list = [...merged.values()].sort((a, b) => b.drwNo - a.drwNo);

  const errs = validateSeries(list);
  if (errs.length) {
    console.error(`\n❌ 검증 실패 ${errs.length}건 — 파일을 쓰지 않습니다.`);
    errs.slice(0, 20).forEach(m => console.error('   - ' + m));
    if (errs.length > 20) console.error(`   ... 외 ${errs.length - 20}건`);
    process.exit(1);
  }

  // 5) 변경분 요약 후 저장
  let changed = 0, added = 0;
  for (const e of list) {
    const old = stored.get(e.drwNo);
    if (!old) added++;
    else if (JSON.stringify(old) !== JSON.stringify(e)) changed++;
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(list, null, 2) + '\n', 'utf-8');
  console.log(`\n🎉 저장 완료 — 총 ${list.length}회차 (최신 ${list[0].drwNo}회 / ${list[0].drwNoDate})`);
  console.log(`   신규 ${added}개, 기존 값 수정 ${changed}개`);
}

main().catch(err => { console.error(err); process.exit(1); });
