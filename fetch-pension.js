#!/usr/bin/env node
// 연금복권 720+ 당첨번호 수집 — 동행복권 신규 사이트 JSON 엔드포인트 사용.
//   GET /pt720/selectPstPt720WnList.do  → 1회차부터 전 회차 1등/보너스 번호 일괄 반환
//
// 사용법:
//   node fetch-pension.js            누락 회차만 추가
//   node fetch-pension.js --rebuild  전 회차를 다시 받아 검증 후 덮어쓰기

const fs = require('fs');
const path = require('path');
const { getJson } = require('./lib/dh-http');

const DATA_PATH = path.join(__dirname, 'public', 'data', 'pension.json');
const REFERER = 'https://www.dhlottery.co.kr/pt720/result';

function toEntry(o) {
  const ymd = String(o.psltRflYmd || '');
  if (!/^\d{8}$/.test(ymd)) return null;
  return {
    drwNo: Number(o.psltEpsd),
    drwNoDate: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6)}`,
    group: Number(o.wnBndNo),
    nums: String(o.wnRnkVl),
    bnusNums: String(o.bnsRnkVl),
  };
}

function validateEntry(e) {
  const errs = [];
  if (!Number.isInteger(e.drwNo) || e.drwNo < 1) errs.push('회차 번호 이상');
  if (!Number.isInteger(e.group) || e.group < 1 || e.group > 5) errs.push(`조 범위 이탈(${e.group})`);
  if (!/^\d{6}$/.test(e.nums)) errs.push(`1등 번호 형식 오류(${e.nums})`);
  if (!/^\d{6}$/.test(e.bnusNums)) errs.push(`보너스 번호 형식 오류(${e.bnusNums})`);
  const d = new Date(`${e.drwNoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) errs.push('날짜 파싱 실패');
  else if (d.getUTCDay() !== 4) errs.push(`추첨일이 목요일이 아님(${e.drwNoDate})`);
  return errs;
}

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

  const json = await getJson('/pt720/selectPstPt720WnList.do', REFERER);
  const rows = json && json.data && json.data.result;
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('❌ 엔드포인트에서 데이터를 받지 못했습니다. (네트워크 또는 사이트 구조 변경 확인)');
    process.exit(1);
  }

  const fetched = rows.map(toEntry).filter(Boolean);
  const latest = fetched.reduce((m, e) => Math.max(m, e.drwNo), 0);
  const storedLatest = existing.length ? Math.max(...stored.keys()) : 0;
  console.log(`✅ 저장됨: ${existing.length}개 회차 (최신 ${storedLatest || '-'}회)`);
  console.log(`🎯 사이트 최신: ${latest}회 (${fetched.length}건 수신)`);

  const merged = new Map(rebuild ? [] : stored);
  for (const e of fetched) {
    if (rebuild || !merged.has(e.drwNo)) merged.set(e.drwNo, e);
  }
  const list = [...merged.values()].sort((a, b) => b.drwNo - a.drwNo);

  const errs = validateSeries(list);
  if (errs.length) {
    console.error(`\n❌ 검증 실패 ${errs.length}건 — 파일을 쓰지 않습니다.`);
    errs.slice(0, 20).forEach(m => console.error('   - ' + m));
    if (errs.length > 20) console.error(`   ... 외 ${errs.length - 20}건`);
    process.exit(1);
  }

  let added = 0, changed = 0;
  for (const e of list) {
    const old = stored.get(e.drwNo);
    if (!old) added++;
    else if (JSON.stringify(old) !== JSON.stringify(e)) changed++;
  }
  if (added === 0 && changed === 0) {
    console.log('이미 최신 상태입니다.');
    return;
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(list, null, 2) + '\n', 'utf-8');
  console.log(`\n🎉 저장 완료 — 총 ${list.length}회차 (최신 ${list[0].drwNo}회 / ${list[0].drwNoDate})`);
  console.log(`   신규 ${added}개, 기존 값 수정 ${changed}개`);
}

main().catch(err => { console.error(err); process.exit(1); });
