// public/js/pension.js
'use strict';

let selectedGroup = 'all';
let simCount = 10;

const PENSION_PRIZES = [
  { rank: '1등', prob: 1/5000000, amount: 168000000 },
  { rank: '2등', prob: 4/5000000, amount: 12000000 },
  { rank: '3등', prob: 2/500000, amount: 1000000 },
  { rank: '4등', prob: 2/50000, amount: 100000 },
  { rank: '5등', prob: 2/5000, amount: 50000 },
  { rank: '6등', prob: 2/500, amount: 5000 },
  { rank: '7등', prob: 1/10, amount: 1000 },
];

// 연금복권 세트 상태
const pensionSets = Array.from({length: 5}, (_, i) => ({
  id: i + 1,
  mode: 'auto',       // 'auto' | 'manual' | null
  autoResult: null,   // { group: '3', nums: '123456' }
  manualGroup: '',    // '1'~'5'
  manualNums: Array(6).fill(''),
}));

// --- 데이터 로드 ---
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

// --- 조 선택 ---
function selectGroup(g) {
  selectedGroup = g;
  document.querySelectorAll('.group-chip').forEach(el => {
    const val = el.dataset.group === 'all' ? 'all' : parseInt(el.dataset.group);
    el.classList.toggle('active', val === selectedGroup);
  });
}

// --- 자릿수 고정 입력 ---
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

// --- 세트 렌더링 ---
function initPensionSetList() {
  const el = document.getElementById('pensionSetList');
  if (!el) return;
  el.innerHTML = pensionSets.map(s => renderPensionSetItem(s)).join('');
}

function renderPensionSetItem(s) {
  const isAuto = s.mode === 'auto';
  const isManual = s.mode === 'manual';
  const stateClass = isAuto ? 'set-auto' : isManual ? 'set-manual' : 'set-inactive';

  let rightContent = '';
  if (isAuto && s.autoResult) {
    const digitHtml = s.autoResult.nums.split('').map(d =>
      `<div class="ticket-digit" style="width:22px;height:26px;font-size:.8rem;border-radius:4px">${d}</div>`
    ).join('');
    rightContent = `<div class="pension-set-result">
      <div class="ticket-group" style="font-size:.78rem;padding:.18rem .42rem">${s.autoResult.group}조</div>
      <span style="color:var(--text3);font-size:.72rem">-</span>
      <div style="display:flex;gap:2px">${digitHtml}</div>
    </div>`;
  } else if (isAuto) {
    rightContent = `<div class="pension-set-result">
      <div class="pension-ph-group"></div>
      <div style="display:flex;gap:2px">${Array(6).fill('<div class="ball-placeholder"></div>').join('')}</div>
    </div>`;
  } else if (isManual) {
    rightContent = renderPensionManualInputs(s);
  } else {
    rightContent = `<span class="set-excluded">— 제외 —</span>`;
  }

  return `<div class="set-item ${stateClass}" id="pset-${s.id}">
    <div class="set-row">
      <span class="set-num">${s.id}세트</span>
      <div class="set-toggle-group">
        <button class="set-tgl ${isAuto ? 'on-auto' : ''}" onclick="togglePensionSetMode(${s.id},'auto')">자동</button>
        <button class="set-tgl ${isManual ? 'on-manual' : ''}" onclick="togglePensionSetMode(${s.id},'manual')">수동</button>
      </div>
      ${rightContent}
    </div>
  </div>`;
}

function renderPensionManualInputs(s) {
  const gv = s.manualGroup || '';
  const nums = s.manualNums || Array(6).fill('');
  const groupInput = `<input
    class="manual-input pension-group-inp${gv ? ' filled' : ''}"
    id="pmanual-${s.id}-g"
    type="text" inputmode="numeric" maxlength="1"
    value="${gv}" placeholder="조"
    oninput="onPensionGroupInput(${s.id},this)"
    onclick="this.select()" />`;
  const digitInputs = nums.map((v, i) => `<input
    class="manual-input${v ? ' filled' : ''}"
    id="pmanual-${s.id}-${i}"
    type="text" inputmode="numeric" maxlength="1"
    value="${v}" placeholder="?"
    oninput="onPensionDigitInput(${s.id},${i},this)"
    onkeydown="onPensionKeydown(${s.id},${i},event)"
    onclick="this.select()" />`).join('');
  return `<div class="pension-manual-wrap">
    ${groupInput}
    <span style="color:var(--text3);font-size:.7rem;flex-shrink:0">조 -</span>
    <div style="display:flex;gap:3px">${digitInputs}</div>
  </div>`;
}

function togglePensionSetMode(id, mode) {
  const s = pensionSets[id - 1];
  if (s.mode === mode) {
    s.mode = null;
  } else {
    s.mode = mode;
    if (mode === 'manual') s.autoResult = null;
    if (mode === 'auto') { s.manualGroup = ''; s.manualNums = Array(6).fill(''); }
  }
  updatePensionSetItem(id);
}

function updatePensionSetItem(id) {
  const s = pensionSets[id - 1];
  const el = document.getElementById(`pset-${id}`);
  if (!el) return;
  el.outerHTML = renderPensionSetItem(s);
  if (s.mode === 'manual') {
    setTimeout(() => document.getElementById(`pmanual-${id}-g`)?.focus(), 50);
  }
}

// --- 수동 입력 핸들러 ---
function onPensionGroupInput(setId, el) {
  el.value = el.value.replace(/[^1-5]/g, '').slice(0, 1);
  const s = pensionSets[setId - 1];
  s.manualGroup = el.value;
  el.classList.toggle('filled', el.value.length > 0);
  if (el.value) document.getElementById(`pmanual-${setId}-0`)?.focus();
}

function onPensionDigitInput(setId, idx, el) {
  el.value = el.value.replace(/[^0-9]/g, '').slice(0, 1);
  const s = pensionSets[setId - 1];
  if (!s.manualNums) s.manualNums = Array(6).fill('');
  s.manualNums[idx] = el.value;
  el.classList.toggle('filled', el.value.length > 0);
  if (el.value) movePensionFocus(setId, idx, 1);
}

function onPensionKeydown(setId, idx, e) {
  if (['Enter', 'Tab', 'ArrowRight'].includes(e.key)) { e.preventDefault(); movePensionFocus(setId, idx, 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); movePensionFocus(setId, idx, -1); }
  if (e.key === 'Backspace') {
    const el = document.getElementById(`pmanual-${setId}-${idx}`);
    if (el && el.value === '') {
      if (idx === 0) document.getElementById(`pmanual-${setId}-g`)?.focus();
      else movePensionFocus(setId, idx, -1);
    }
  }
}

function movePensionFocus(setId, idx, dir) {
  const next = idx + dir;
  if (next >= 0 && next < 6) document.getElementById(`pmanual-${setId}-${next}`)?.focus();
}

// --- 자동 번호 생성 ---
function generatePensionSets() {
  const autoSets = pensionSets.filter(s => s.mode === 'auto');
  if (autoSets.length === 0) {
    alert('자동 세트가 없습니다. 최소 1개 세트를 자동으로 설정해주세요.');
    return;
  }
  const fixedDigits = getFixedDigits();

  if (selectedGroup === 'all') {
    // 각 세트에 1~5조 순서대로 배정
    autoSets.forEach((s, idx) => {
      let nums = '';
      for (let j = 0; j < 6; j++) {
        nums += fixedDigits[j] !== null ? fixedDigits[j] : Math.floor(Math.random() * 10);
      }
      s.autoResult = { group: String((idx % 5) + 1), nums };
    });
  } else {
    autoSets.forEach(s => {
      let nums = '';
      for (let j = 0; j < 6; j++) {
        nums += fixedDigits[j] !== null ? fixedDigits[j] : Math.floor(Math.random() * 10);
      }
      s.autoResult = { group: String(selectedGroup), nums };
    });
  }

  const el = document.getElementById('pensionSetList');
  if (el) el.innerHTML = pensionSets.map(s => renderPensionSetItem(s)).join('');
}

// --- 구매 확정 ---
function confirmPensionRound() {
  const activeSets = pensionSets.filter(s => s.mode !== null);
  if (activeSets.length === 0) {
    alert('최소 1개 이상의 세트를 선택해주세요.');
    return;
  }
  for (const s of activeSets) {
    if (s.mode === 'auto') {
      if (!s.autoResult) { alert('숫자가 입력되지 않은 세트가 있습니다.'); return; }
    } else if (s.mode === 'manual') {
      if (!s.manualGroup || !/^[1-5]$/.test(s.manualGroup)) {
        alert('숫자가 입력되지 않은 세트가 있습니다.'); return;
      }
      const incomplete = !s.manualNums || s.manualNums.some(v => v === '' || v === undefined);
      if (incomplete) { alert('숫자가 입력되지 않은 세트가 있습니다.'); return; }
    }
  }

  const data = activeSets.map(s =>
    s.mode === 'auto'
      ? `${s.autoResult.group}조 ${s.autoResult.nums}`
      : `${s.manualGroup}조 ${s.manualNums.join('')}`
  );
  saveHistoryLocal('pension', data);
  renderHistoryList('pension');

  // 라운드 초기화
  pensionSets.forEach(s => { s.mode = 'auto'; s.autoResult = null; s.manualGroup = ''; s.manualNums = Array(6).fill(''); });
  const el = document.getElementById('pensionSetList');
  if (el) el.innerHTML = pensionSets.map(s => renderPensionSetItem(s)).join('');
  const toast = document.getElementById('copyToast');
  if (toast) { toast.textContent = '구매가 확정되었습니다 ✓'; toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); toast.textContent = '번호가 복사되었습니다'; }, 1800); }
}

// --- 시뮬레이터 ---
function adjustSimCount(delta) {
  simCount = Math.max(1, Math.min(100, simCount + delta));
  document.getElementById('simCount').textContent = simCount;
  renderPensionSim();
}

function renderPensionSim() {
  const yearly = simCount * 12;
  const cost = yearly * 1000;
  let totalExpected = 0;
  const rows = PENSION_PRIZES.map(p => {
    const expTimes = yearly * p.prob;
    totalExpected += expTimes * p.amount;
    return { ...p, expTimes };
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

// --- 서브탭 전환 ---
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

// --- 탭 렌더링 ---
function initPension() {
  renderPensionGenTab();
  renderPensionInfoTab();
  loadPensionResult();
}

function renderPensionGenTab() {
  const el = document.getElementById('sub-pension-gen');
  if (!el) return;
  el.innerHTML = `
    <!-- 최근 당첨번호 -->
    <div class="card">
      <div class="card-label">최근 당첨번호</div>
      <div id="pensionLastDraw"><div class="skeleton" style="height:70px"></div></div>
    </div>

    <!-- 라운드 / 세트 -->
    <div class="card">
      <div class="card-label">라운드 1 · 5세트</div>
      <div id="pensionSetList"></div>
    </div>

    <!-- 생성 옵션 (아코디언) -->
    <div class="card" style="padding:0">
      <div class="accordion-header" onclick="togglePensionOptions()">
        <div class="accordion-title">⚙️ 생성 옵션</div>
        <span class="accordion-chevron" id="pensionOptionsChevron">▲</span>
      </div>
      <div class="accordion-body" id="pensionOptionsBody">
        <div class="option-row" style="flex-wrap:wrap;gap:.4rem">
          <span class="option-label" style="width:100%">조 번호 선택</span>
          <div class="group-selector" id="groupSelector">
            <div class="group-chip active" data-group="all" onclick="selectGroup('all')">모든 조</div>
            ${[1,2,3,4,5].map(g=>`<div class="group-chip" data-group="${g}" onclick="selectGroup(${g})">${g}조</div>`).join('')}
          </div>
        </div>
        <div class="option-row" style="margin-top:.5rem">
          <span class="option-label">자릿수 고정 <span style="color:var(--text3);font-size:.68rem">(빈칸=랜덤)</span></span>
        </div>
        <div class="digit-fix" style="margin-top:.3rem">
          ${[1,2,3,4,5,6].map(i=>`<input class="digit-slot" id="pDigit${i}" maxlength="1" inputmode="numeric" placeholder="?" oninput="onDigitInput(this,'${i<6?'pDigit'+(i+1):'null'}')">`).join('')}
        </div>
        <div style="font-size:.65rem;color:var(--text3);text-align:center;margin-top:.3rem">원하는 자리에 0~9 입력 시 고정</div>
      </div>
    </div>

    <!-- 버튼 -->
    <div class="btn-row">
      <button class="btn-primary" style="background:linear-gradient(135deg,var(--pension),#c2410c)" onclick="generatePensionSets()">✨ 자동 생성</button>
      <button class="btn-primary btn-confirm" onclick="confirmPensionRound()">🛒 구매 확정</button>
    </div>
  `;
  initPensionSetList();
}

let pensionOptionsOpen = true;
function togglePensionOptions() {
  pensionOptionsOpen = !pensionOptionsOpen;
  document.getElementById('pensionOptionsBody')?.classList.toggle('hidden', !pensionOptionsOpen);
  document.getElementById('pensionOptionsChevron').textContent = pensionOptionsOpen ? '▲' : '▼';
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
