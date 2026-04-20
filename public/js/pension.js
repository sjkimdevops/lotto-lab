// public/js/pension.js
'use strict';

let pensionSetCount = 5;
let selectedGroup = 'all';
let simCount = 10;

const PENSION_PRIZES = [
  { rank: '1등', prob: 1/5000000, amount: 168000000, label: '16.8억(총액)' },
  { rank: '2등', prob: 4/5000000, amount: 12000000, label: '1.2억(총액)' },
  { rank: '3등', prob: 2/500000, amount: 1000000, label: '100만원' },
  { rank: '4등', prob: 2/50000, amount: 100000, label: '10만원' },
  { rank: '5등', prob: 2/5000, amount: 50000, label: '5만원' },
  { rank: '6등', prob: 2/500, amount: 5000, label: '5천원' },
  { rank: '7등', prob: 1/10, amount: 1000, label: '1천원' },
];

async function loadPensionResult() {
  const el = document.getElementById('pensionLastDraw');
  if (!el) return;
  try {
    const res = await fetch('data/pension.json');
    if (!res.ok) throw new Error('fetch failed');
    const all = await res.json();
    const latest = all[0];
    if (latest) renderPensionLastDraw(latest, el);
  } catch {
    el.innerHTML = '<div style="color:var(--text3);font-size:.8rem">당첨번호를 불러올 수 없습니다</div>';
  }
}

function renderPensionLastDraw(data, el) {
  const numDisplay = data.nums
    ? data.nums.split('').map(d => `<div class="ticket-digit">${d}</div>`).join('')
    : '<span style="color:var(--text3)">-</span>';
  el.innerHTML = `
    <div class="card-title">${data.drwNo}회 (${data.drwNoDate})</div>
    <div style="margin-top:.5rem;display:flex;align-items:center;gap:.55rem;flex-wrap:wrap">
      <div class="ticket-group">${data.group}조</div>
      <span style="color:var(--text3);font-size:.78rem">-</span>
      <div class="ticket-digits">${numDisplay}</div>
    </div>
    <div style="font-size:.68rem;color:var(--text3);margin-top:.4rem">2등: 나머지 4개 조 동일 번호</div>`;
}

function selectGroup(g) {
  selectedGroup = g;
  document.querySelectorAll('.group-chip').forEach(el => {
    const val = el.dataset.group === 'all' ? 'all' : parseInt(el.dataset.group);
    el.classList.toggle('active', val === selectedGroup);
  });
}

function onDigitInput(el, nextId) {
  el.value = el.value.replace(/[^0-9]/g, '').slice(0, 1);
  if (el.value && nextId !== 'null') document.getElementById(nextId)?.focus();
}

function getFixedDigits() {
  return Array.from({length: 6}, (_, i) => {
    const v = document.getElementById('pDigit' + (i+1))?.value;
    return v !== '' && v !== undefined ? v : null;
  });
}

function generatePension() {
  const fixedDigits = getFixedDigits();
  const generatedSets = [];
  if (selectedGroup === 'all') {
    let nums = '';
    for (let j = 0; j < 6; j++) {
      nums += fixedDigits[j] !== null ? fixedDigits[j] : Math.floor(Math.random() * 10);
    }
    for (let g = 1; g <= 5; g++) generatedSets.push({ group: String(g), nums, fixedDigits: [...fixedDigits] });
  } else {
    for (let i = 0; i < pensionSetCount; i++) {
      let nums = '';
      for (let j = 0; j < 6; j++) {
        nums += fixedDigits[j] !== null ? fixedDigits[j] : Math.floor(Math.random() * 10);
      }
      generatedSets.push({ group: String(selectedGroup), nums, fixedDigits: [...fixedDigits] });
    }
  }
  document.getElementById('pensionResults').innerHTML = generatedSets.map((s, i) => {
    const digitHtml = s.nums.split('').map((d, j) =>
      `<div class="ticket-digit${s.fixedDigits[j] !== null ? ' fixed' : ''}">${d}</div>`
    ).join('');
    return `<div class="ticket" style="animation:fadeIn .3s ${i*.07}s both" onclick="copyNums('${s.group}조 ${s.nums}')">
      <div class="ticket-header">
        <span class="ticket-label">세트 ${i+1}</span>
        <span style="font-size:.58rem;color:var(--text3)">탭하여 복사</span>
      </div>
      <div class="ticket-body">
        <div class="ticket-group">${s.group}조</div>
        <span style="color:var(--text3);font-size:.78rem">-</span>
        <div class="ticket-digits">${digitHtml}</div>
      </div>
    </div>`;
  }).join('');
  saveHistoryLocal('pension', generatedSets.map(s => `${s.group}조 ${s.nums}`));
  renderHistoryList('pension');
}

function adjustSimCount(delta) {
  simCount = Math.max(1, Math.min(100, simCount + delta));
  document.getElementById('simCount').textContent = simCount;
  renderPensionSim();
}

function renderPensionSim() {
  const monthly = simCount;
  const yearly = monthly * 12;
  const cost = yearly * 1000;
  let totalExpected = 0;
  const rows = PENSION_PRIZES.map(p => {
    const expTimes = yearly * p.prob;
    const expAmount = expTimes * p.amount;
    totalExpected += expAmount;
    return { ...p, expTimes, expAmount };
  });
  const roi = ((totalExpected / cost) * 100).toFixed(1);

  const simResult = document.getElementById('simResult');
  if (simResult) simResult.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat-box"><div class="val" style="color:var(--pension)">${yearly}장</div><div class="lbl">연간 구매</div></div>
      <div class="stat-box"><div class="val" style="color:var(--pension)">${(cost/10000).toFixed(0)}만원</div><div class="lbl">연간 비용</div></div>
      <div class="stat-box"><div class="val" style="color:var(--pension)">${totalExpected >= 10000 ? (totalExpected/10000).toFixed(1)+'만' : Math.round(totalExpected)}원</div><div class="lbl">기대 당첨금</div></div>
      <div class="stat-box"><div class="val" style="color:${parseFloat(roi)>=100?'var(--ball-5)':'var(--ball-3)'}">${roi}%</div><div class="lbl">기대 수익률</div></div>
    </div>`;

  const maxExp = Math.max(...rows.map(r => r.expTimes));
  const chart = document.getElementById('pensionExpChart');
  if (chart) chart.innerHTML = `<div class="freq-chart">${rows.map(r => {
    const barW = maxExp > 0 ? (r.expTimes/maxExp*100) : 0;
    const timesStr = r.expTimes>=1 ? r.expTimes.toFixed(1)+'회' : r.expTimes>=0.01 ? r.expTimes.toFixed(2)+'회' : r.expTimes.toExponential(1);
    return `<div class="freq-row">
      <div style="min-width:26px;font-size:.7rem;font-weight:600;color:var(--pension);flex-shrink:0">${r.rank}</div>
      <div class="freq-bar-bg"><div class="freq-bar" style="width:${barW.toFixed(1)}%;background:var(--pension)"></div></div>
      <div class="freq-cnt" style="width:46px">${timesStr}</div>
    </div>`;
  }).join('')}</div>`;
}

function switchPensionSub(sub) {
  document.querySelectorAll('[data-psub]').forEach(t => t.classList.toggle('active', t.dataset.psub === sub));
  ['pension-gen', 'pension-info', 'pension-history'].forEach(s => {
    const el = document.getElementById('sub-' + s);
    if (el) el.classList.toggle('hidden', s !== sub);
  });
  if (sub === 'pension-info') renderPensionSim();
  if (sub === 'pension-history') renderPensionHistoryTab();
}

function renderPensionHistoryTab() {
  const el = document.getElementById('sub-pension-history');
  if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="history-header">
        <div class="card-label" style="margin-bottom:0">생성 히스토리</div>
        <button class="history-clear" onclick="clearHistory('pension')">전체 삭제</button>
      </div>
      <div id="pensionHistoryList"></div>
    </div>`;
  renderHistoryList('pension');
}

function initPension() {
  renderPensionGenTab();
  renderPensionInfoTab();
  loadPensionResult();
}

function renderPensionGenTab() {
  const el = document.getElementById('sub-pension-gen');
  if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="card-label">최근 당첨번호</div>
      <div id="pensionLastDraw"><div class="skeleton" style="height:70px"></div></div>
    </div>
    <div class="card">
      <div class="card-label">생성 옵션</div>
      <div class="option-row">
        <span class="option-label">생성 세트 수</span>
        <div class="stepper">
          <button onclick="adjustSets('pension',-1)">−</button>
          <span id="pensionSetCount">5</span>
          <button onclick="adjustSets('pension',1)">+</button>
        </div>
      </div>
      <div class="option-row" style="flex-wrap:wrap;gap:.4rem">
        <span class="option-label" style="width:100%">조 번호 선택</span>
        <div class="group-selector" id="groupSelector">
          <div class="group-chip active" data-group="all" onclick="selectGroup('all')">모든 조</div>
          ${[1,2,3,4,5].map(g=>`<div class="group-chip" data-group="${g}" onclick="selectGroup(${g})">${g}조</div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-label">자릿수 고정 (빈칸 = 랜덤)</div>
      <div class="digit-fix">
        ${[1,2,3,4,5,6].map(i=>`<input class="digit-slot" id="pDigit${i}" maxlength="1" inputmode="numeric" placeholder="?" oninput="onDigitInput(this,'${i<6?'pDigit'+(i+1):'null'}')">`).join('')}
      </div>
      <div style="font-size:.65rem;color:var(--text3);text-align:center;margin-top:.3rem">원하는 자리에 0~9 입력 시 고정</div>
    </div>
    <button class="btn-primary" style="background:linear-gradient(135deg,var(--pension),#c2410c)" onclick="generatePension()">연금복권 번호 생성</button>
    <div id="pensionResults"></div>`;
}

function renderPensionInfoTab() {
  const el = document.getElementById('sub-pension-info');
  if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="card-label">당첨 구조</div>
      <table class="prize-table">
        <tr><th>등수</th><th>당첨금</th><th>조건</th><th>확률</th></tr>
        <tr><td><span class="prize-rank">1등</span></td><td><span class="prize-amount">월 700만×20년</span></td><td>조+6자리</td><td>1/5,000,000</td></tr>
        <tr><td><span class="prize-rank">2등</span></td><td><span class="prize-amount">월 100만×10년</span></td><td>6자리(조 다름)</td><td>4/5,000,000</td></tr>
        <tr><td><span class="prize-rank">3등</span></td><td><span class="prize-amount">100만원</span></td><td>앞/뒤 5자리</td><td>1/50,000</td></tr>
        <tr><td><span class="prize-rank">4등</span></td><td><span class="prize-amount">10만원</span></td><td>앞/뒤 4자리</td><td>1/5,000</td></tr>
        <tr><td><span class="prize-rank">5등</span></td><td><span class="prize-amount">5만원</span></td><td>앞/뒤 3자리</td><td>1/500</td></tr>
        <tr><td><span class="prize-rank">6등</span></td><td><span class="prize-amount">5천원</span></td><td>앞/뒤 2자리</td><td>1/50</td></tr>
        <tr><td><span class="prize-rank">7등</span></td><td><span class="prize-amount">1천원</span></td><td>끝 1자리</td><td>1/10</td></tr>
      </table>
    </div>
    <div class="card">
      <div class="card-label">기대값 시뮬레이터</div>
      <div class="option-row">
        <span class="option-label">월 구매 장수</span>
        <div class="stepper">
          <button onclick="adjustSimCount(-1)">−</button>
          <span id="simCount">10</span>
          <button onclick="adjustSimCount(1)">+</button>
        </div>
      </div>
      <div id="simResult" style="margin-top:.6rem"></div>
    </div>
    <div class="card">
      <div class="card-label">등수별 당첨 기대 횟수 (연간)</div>
      <div id="pensionExpChart"></div>
    </div>`;
  renderPensionSim();
}

function adjustSets(type, delta) {
  if (type === 'pension') {
    pensionSetCount = Math.max(1, Math.min(10, pensionSetCount + delta));
    const el = document.getElementById('pensionSetCount');
    if (el) el.textContent = pensionSetCount;
  }
}
