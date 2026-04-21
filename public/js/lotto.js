// public/js/lotto.js
'use strict';

// --- 상태 ---
let fullData = [], allData = [], freqMap = {}, latestRound = 0;
let includeNums = new Set(), excludeNums = new Set();
let optionsOpen = true;

const LEVEL_LABELS = ['OFF', '약간', '보통', '강하게', '매우강', '최대'];

// 세트 상태: mode = 'auto' | 'manual' | null
const sets = Array.from({length: 5}, (_, i) => ({
  id: i + 1,
  mode: 'auto',
  autoNums: null,
  manualNums: null,
}));

// --- 데이터 로드 ---
async function loadData() {
  setStatus('데이터 불러오는 중...', 'loading');
  try {
    const res = await fetch('data/lotto.json');
    fullData = await res.json();
    fullData.sort((a, b) => b.drwNo - a.drwNo);
    latestRound = fullData[0].drwNo;
    applyRange();
  } catch (e) {
    setStatus('데이터 로딩 실패', 'error');
    console.error(e);
  }
}

function applyRange() {
  const count = parseInt(document.getElementById('analysisRange')?.value || '50');
  allData = fullData.slice(0, count);
  buildFreqMap();
  renderLastDraw();
  renderStats();
  setStatus(`${latestRound}회차 기준 · ${allData.length}회 분석`, 'ok');
  updateOptionBadges();
}

function changeAnalysisRange() {
  if (fullData.length) applyRange();
}

// --- 주파수 맵 ---
function buildFreqMap() {
  freqMap = {};
  for (let i = 1; i <= 45; i++) freqMap[i] = 0;
  allData.forEach(d => {
    for (let i = 1; i <= 6; i++) freqMap[d[`drwtNo${i}`]]++;
    freqMap[d.bnusNo]++;
  });
}

// --- 상태칩 ---
function setStatus(msg, state) {
  const textEl = document.getElementById('statusText');
  const chipEl = document.getElementById('statusChip');
  if (textEl) textEl.textContent = msg;
  if (chipEl) {
    const cls = state === 'loading' ? ' loading' : state === 'error' ? ' error' : '';
    chipEl.className = 'status-chip' + cls;
  }
}

// --- 볼 렌더링 ---
function ballClass(n) {
  if (n <= 10) return 'r1';
  if (n <= 20) return 'r2';
  if (n <= 30) return 'r3';
  if (n <= 40) return 'r4';
  return 'r5';
}
function makeBall(n, sm = false) {
  return `<div class="ball ${ballClass(n)}${sm ? ' ball-sm' : ''}">${n}</div>`;
}

// --- 최근 당첨번호 ---
function renderLastDraw() {
  if (!allData.length) return;
  const d = allData[0];
  const el = document.getElementById('lastDraw');
  if (!el) return;
  el.innerHTML = `
    <div class="card-title">${d.drwNo}회 (${d.drwNoDate})</div>
    <div class="last-draw">
      <div class="balls">${[1,2,3,4,5,6].map(i => makeBall(d[`drwtNo${i}`])).join('')}</div>
      <span class="bonus-sep">+</span>${makeBall(d.bnusNo)}
    </div>`;
}

// --- 통계 렌더링 ---
function renderStats() {
  if (!allData.length) return;
  const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
  const maxFreq = sorted[0][1];
  const avg = (allData.reduce((s, d) => {
    let sum = 0;
    for (let i = 1; i <= 6; i++) sum += d[`drwtNo${i}`];
    return s + sum / 6;
  }, 0) / allData.length).toFixed(1);
  const avgOdd = (allData.map(d => {
    let odd = 0;
    for (let i = 1; i <= 6; i++) if (d[`drwtNo${i}`] % 2 === 1) odd++;
    return odd;
  }).reduce((a, b) => a + b, 0) / allData.length).toFixed(1);

  const statGrid = document.getElementById('statGrid');
  if (statGrid) statGrid.innerHTML = `
    <div class="stat-box"><div class="val">${allData.length}</div><div class="lbl">분석 회차</div></div>
    <div class="stat-box"><div class="val">${avg}</div><div class="lbl">평균 번호</div></div>
    <div class="stat-box"><div class="val">${avgOdd}:${(6-parseFloat(avgOdd)).toFixed(1)}</div><div class="lbl">홀:짝</div></div>`;

  const hotChart = document.getElementById('hotChart');
  if (hotChart) hotChart.innerHTML = `<div class="freq-chart">${sorted.slice(0,10).map(([n,c]) => `
    <div class="freq-row">
      <div class="freq-num ball ${ballClass(Number(n))}">${n}</div>
      <div class="freq-bar-bg"><div class="freq-bar" style="width:${(c/maxFreq*100).toFixed(1)}%;background:var(--accent2)"></div></div>
      <div class="freq-cnt">${c}</div>
    </div>`).join('')}</div>`;

  const coldChart = document.getElementById('coldChart');
  if (coldChart) coldChart.innerHTML = `<div class="freq-chart">${sorted.slice(-10).reverse().map(([n,c]) => `
    <div class="freq-row">
      <div class="freq-num ball ${ballClass(Number(n))}">${n}</div>
      <div class="freq-bar-bg"><div class="freq-bar" style="width:${(c/maxFreq*100).toFixed(1)}%;background:var(--ball-3)"></div></div>
      <div class="freq-cnt">${c}</div>
    </div>`).join('')}</div>`;
}

// --- 번호 생성 알고리즘 ---
function generateNums() {
  const hotLevel = parseInt(document.getElementById('optHotLevel')?.value || '3');
  const coldLevel = parseInt(document.getElementById('optColdLevel')?.value || '1');
  const allowConsec = document.getElementById('optConsec')?.checked || false;
  const sorted = Object.entries(freqMap).sort((a, b) => b[1] - a[1]);
  const hotNums = sorted.slice(0, 15).map(e => Number(e[0])).filter(n => !excludeNums.has(n));
  const coldNums = sorted.slice(-15).map(e => Number(e[0])).filter(n => !excludeNums.has(n));
  const hotWeight = hotLevel * 0.1;
  const coldWeight = coldLevel * 0.1;
  const total = hotWeight + coldWeight;
  const hotProb = total > 0 ? hotWeight / (total + 1) : 0;
  const coldProb = total > 0 ? coldWeight / (total + 1) : 0;

  let nums = new Set(includeNums);
  let attempts = 0;
  while (nums.size < 6 && attempts < 500) {
    attempts++;
    let n;
    const r = Math.random();
    if (r < hotProb && hotNums.length) n = hotNums[Math.floor(Math.random() * hotNums.length)];
    else if (r < hotProb + coldProb && coldNums.length) n = coldNums[Math.floor(Math.random() * coldNums.length)];
    else n = Math.floor(Math.random() * 45) + 1;
    if (excludeNums.has(n)) continue;
    if (!allowConsec && nums.size > 0) {
      if ([...nums].some(x => Math.abs(x - n) === 1)) continue;
    }
    nums.add(n);
  }
  return [...nums].sort((a, b) => a - b);
}

// --- 레벨 라벨 ---
function updateLevelLabel(type) {
  const id = type === 'hot' ? 'optHotLevel' : 'optColdLevel';
  const labelId = type === 'hot' ? 'hotLevelLabel' : 'coldLevelLabel';
  const val = parseInt(document.getElementById(id)?.value || '0');
  const el = document.getElementById(labelId);
  if (el) el.textContent = LEVEL_LABELS[val];
  updateOptionBadges();
}

// --- 번호 고정/제외 ---
function initNumGrid() {
  const grid = document.getElementById('numGrid');
  if (!grid) return;
  let html = '';
  for (let i = 1; i <= 45; i++) {
    html += `<div class="num-cell" data-num="${i}" onclick="toggleNum(${i})" ondblclick="toggleExclude(${i})">${i}</div>`;
  }
  grid.innerHTML = html;
}

function toggleNum(n) {
  if (excludeNums.has(n)) { excludeNums.delete(n); }
  else if (includeNums.has(n)) { includeNums.delete(n); }
  else { if (includeNums.size >= 5) return; includeNums.add(n); }
  updatePickerUI();
  updateOptionBadges();
}

function toggleExclude(n) {
  includeNums.delete(n);
  if (excludeNums.has(n)) { excludeNums.delete(n); }
  else { excludeNums.add(n); }
  updatePickerUI();
  updateOptionBadges();
}

function resetPicker() {
  includeNums.clear();
  excludeNums.clear();
  updatePickerUI();
  updateOptionBadges();
}

function updatePickerUI() {
  document.querySelectorAll('.num-cell').forEach(el => {
    const n = parseInt(el.dataset.num);
    el.className = 'num-cell'
      + (includeNums.has(n) ? ' include' : '')
      + (excludeNums.has(n) ? ' exclude' : '');
  });
  const inc = includeNums.size > 0 ? [...includeNums].sort((a,b)=>a-b).join(', ') : '없음';
  const exc = excludeNums.size > 0 ? [...excludeNums].sort((a,b)=>a-b).join(', ') : '없음';
  const el = document.getElementById('pickerStatus');
  if (el) el.textContent = `고정: ${inc} | 제외: ${exc}`;
}

// --- 아코디언 옵션 배지 ---
function updateOptionBadges() {
  const badge = document.getElementById('optionBadges');
  if (!badge) return;
  const range = document.getElementById('analysisRange')?.value || '50';
  const hotVal = parseInt(document.getElementById('optHotLevel')?.value || '3');
  const coldVal = parseInt(document.getElementById('optColdLevel')?.value || '1');
  const incCount = includeNums.size;
  const excCount = excludeNums.size;
  const parts = [
    `${range}회 분석`,
    hotVal > 0 ? `핫 ${LEVEL_LABELS[hotVal]}` : null,
    coldVal > 0 ? `콜드 ${LEVEL_LABELS[coldVal]}` : null,
    incCount > 0 ? `고정 ${[...includeNums].sort((a,b)=>a-b).join('·')}` : null,
    excCount > 0 ? `제외 ${[...excludeNums].sort((a,b)=>a-b).join('·')}` : null,
  ].filter(Boolean);
  badge.innerHTML = parts.map(t => `<span class="opt-badge">${t}</span>`).join('');
}

// --- 아코디언 토글 ---
function toggleOptions() {
  optionsOpen = !optionsOpen;
  const body = document.getElementById('optionsBody');
  const chevron = document.getElementById('optionsChevron');
  const badgeRow = document.getElementById('optionBadges');
  if (body) body.classList.toggle('hidden', !optionsOpen);
  if (chevron) chevron.textContent = optionsOpen ? '▲' : '▼';
  if (badgeRow) badgeRow.classList.toggle('hidden', optionsOpen);
}

// --- 세트 렌더링 ---
function initSetList() {
  const el = document.getElementById('setList');
  if (!el) return;
  el.innerHTML = sets.map(s => renderSetItem(s)).join('');
}

function renderSetItem(s) {
  const isAuto = s.mode === 'auto';
  const isManual = s.mode === 'manual';
  const stateClass = isAuto ? 'set-auto' : isManual ? 'set-manual' : 'set-inactive';

  let rightContent = '';
  if (isAuto && s.autoNums) {
    rightContent = `<div class="set-balls">${s.autoNums.map(n => makeBall(n, true)).join('')}</div>`;
  } else if (isAuto) {
    rightContent = `<div class="set-balls empty">${Array(6).fill('<div class="ball-placeholder"></div>').join('')}</div>`;
  } else if (isManual) {
    rightContent = renderManualInputs(s);
  } else {
    rightContent = `<span class="set-excluded">— 제외 —</span>`;
  }

  return `<div class="set-item ${stateClass}" id="set-${s.id}">
    <div class="set-row">
      <span class="set-num">${s.id}세트</span>
      <div class="set-toggle-group">
        <button class="set-tgl ${isAuto ? 'on-auto' : ''}" onclick="toggleSetMode(${s.id},'auto')">자동</button>
        <button class="set-tgl ${isManual ? 'on-manual' : ''}" onclick="toggleSetMode(${s.id},'manual')">수동</button>
      </div>
      ${rightContent}
    </div>
  </div>`;
}

function toggleSetMode(id, mode) {
  const s = sets[id - 1];
  if (s.mode === mode) {
    s.mode = null;
  } else {
    s.mode = mode;
    if (mode === 'manual') s.autoNums = null;
    if (mode === 'auto') s.manualNums = null;
  }
  updateSetItem(id);
}

function updateSetItem(id) {
  const s = sets[id - 1];
  const el = document.getElementById(`set-${id}`);
  if (!el) return;
  el.outerHTML = renderSetItem(s);
  if (s.mode === 'manual' && !s.manualNums) {
    setTimeout(() => {
      document.getElementById(`manual-${id}-0`)?.focus();
    }, 50);
  }
}

// --- 수동 입력 ---
function renderManualInputs(s) {
  const nums = s.manualNums || Array(6).fill('');
  const inputs = nums.map((v, i) => `
    <input
      class="manual-input${v ? ' filled' : ''}"
      id="manual-${s.id}-${i}"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="2"
      value="${v}"
      placeholder="?"
      oninput="onManualInput(${s.id},${i},this)"
      onkeydown="onManualKeydown(${s.id},${i},event)"
      onclick="this.select()"
    />`).join('');
  return `<div class="manual-inputs" id="manual-inputs-${s.id}">${inputs}</div>`;
}

function onManualInput(setId, idx, el) {
  el.value = el.value.replace(/[^0-9]/g, '').slice(0, 2);
  const s = sets[setId - 1];
  if (!s.manualNums) s.manualNums = Array(6).fill('');
  s.manualNums[idx] = el.value;
  const num = parseInt(el.value);
  if (el.value.length > 0 && (num < 1 || num > 45 || isNaN(num))) {
    el.classList.add('invalid');
  } else {
    el.classList.remove('invalid');
  }
  el.classList.toggle('filled', el.value.length > 0);
  if (el.value.length === 2) moveManualFocus(setId, idx, 1);
  checkManualComplete(setId);
}

function onManualKeydown(setId, idx, e) {
  if (['Enter', 'Tab', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    moveManualFocus(setId, idx, 1);
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    moveManualFocus(setId, idx, -1);
  }
  if (e.key === 'Backspace') {
    const el = document.getElementById(`manual-${setId}-${idx}`);
    if (el && el.value === '') moveManualFocus(setId, idx, -1);
  }
}

function moveManualFocus(setId, idx, dir) {
  const next = idx + dir;
  if (next >= 0 && next < 6) {
    document.getElementById(`manual-${setId}-${next}`)?.focus();
  }
}

// --- 자동 번호 생성 실행 ---
function generateLottoSets() {
  const autoSets = sets.filter(s => s.mode === 'auto');
  if (autoSets.length === 0) {
    alert('자동 세트가 없습니다. 최소 1개 세트를 자동으로 설정해주세요.');
    return;
  }
  autoSets.forEach(s => { s.autoNums = generateNums(); });
  const el = document.getElementById('setList');
  if (el) el.innerHTML = sets.map(s => renderSetItem(s)).join('');
}

// --- 구매 확정 ---
function confirmLottoRound() {
  const activeSets = sets.filter(s => s.mode !== null);
  if (activeSets.length === 0) {
    alert('최소 1개 이상의 세트를 선택해주세요.');
    return;
  }
  for (const s of activeSets) {
    if (s.mode === 'auto') {
      if (!s.autoNums || s.autoNums.length < 6) {
        alert('숫자가 입력되지 않은 세트가 있습니다.');
        return;
      }
    } else if (s.mode === 'manual') {
      if (!s.manualNums) { alert('숫자가 입력되지 않은 세트가 있습니다.'); return; }
      const invalid = s.manualNums.some(v => {
        const n = parseInt(v);
        return !v || isNaN(n) || n < 1 || n > 45;
      });
      if (invalid) { alert('숫자가 입력되지 않은 세트가 있습니다.'); return; }
    }
  }
  const data = activeSets.map(s => s.mode === 'auto' ? s.autoNums : s.manualNums.map(Number));
  saveHistoryLocal('lotto', data);
  renderHistoryList('lotto');
  // 라운드 초기화
  sets.forEach(s => { s.mode = 'auto'; s.autoNums = null; s.manualNums = null; });
  const el = document.getElementById('setList');
  if (el) el.innerHTML = sets.map(s => renderSetItem(s)).join('');
  const toast = document.getElementById('copyToast');
  if (toast) { toast.textContent = '구매가 확정되었습니다 ✓'; toast.classList.add('show'); setTimeout(() => { toast.classList.remove('show'); toast.textContent = '번호가 복사되었습니다'; }, 1800); }
}

// --- QR 당첨 확인 ---
function openQRScanner() {
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    Capacitor.Plugins.Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: 'dataUrl',
      source: 'CAMERA',
      saveToGallery: false,
    }).then(photo => {
      decodeQRFromDataUrl(photo.dataUrl);
    }).catch(err => {
      if (err && !String(err.message || err).includes('cancel')) {
        alert('카메라 실행에 실패했습니다.');
      }
    });
  } else {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.cssText = 'position:fixed;top:-200px;left:-200px;opacity:0';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) input.setAttribute('capture', 'environment');
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      document.body.removeChild(input);
      if (file) decodeQRFromFile(file);
    });
    document.body.appendChild(input);
    input.click();
  }
}

function decodeQRFromDataUrl(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      const url = code.data;
      if (url.startsWith('http')) {
        window.open(url, '_blank', 'noopener');
      } else {
        alert('QR 코드: ' + url);
      }
    } else {
      alert('QR 코드를 인식하지 못했습니다.\n선명한 사진을 사용해주세요.');
    }
  };
  img.src = dataUrl;
}

function decodeQRFromFile(file) {
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) {
        const url = code.data;
        if (url.startsWith('http')) {
          window.open(url, '_blank', 'noopener');
        } else {
          alert('QR 코드: ' + url);
        }
      } else {
        alert('QR 코드를 인식하지 못했습니다.\n선명한 사진을 사용해주세요.');
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// --- 로또 탭 렌더링 ---
function renderLottoGenTab() {
  const el = document.getElementById('sub-lotto-gen');
  if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="card-label">최근 당첨번호</div>
      <div id="lastDraw"><div class="skeleton" style="height:52px"></div></div>
    </div>

    <div class="card" id="roundCard">
      <div class="card-label">라운드 1 · 5세트</div>
      <div id="setList"></div>
    </div>

    <div class="card" id="optionsCard" style="padding:0">
      <div class="accordion-header" onclick="toggleOptions()">
        <div class="accordion-title">⚙️ 생성 옵션</div>
        <span class="accordion-chevron" id="optionsChevron">▲</span>
      </div>
      <div class="opt-badge-row hidden" id="optionBadges"></div>
      <div class="accordion-body" id="optionsBody">
        <div class="option-row">
          <span class="option-label">분석 회차 수</span>
          <div class="range-control">
            <select id="analysisRange" onchange="changeAnalysisRange()">
              <option value="10">최근 10회</option>
              <option value="20">최근 20회</option>
              <option value="50" selected>최근 50회</option>
              <option value="100">최근 100회</option>
            </select>
          </div>
        </div>
        <div class="option-row">
          <span class="option-label">핫넘버 반영</span>
          <div class="level-control">
            <input type="range" id="optHotLevel" min="0" max="5" value="3" class="level-slider hot-slider" oninput="updateLevelLabel('hot')">
            <span class="level-label" id="hotLevelLabel">보통</span>
          </div>
        </div>
        <div class="option-row">
          <span class="option-label">콜드넘버 반영</span>
          <div class="level-control">
            <input type="range" id="optColdLevel" min="0" max="5" value="1" class="level-slider cold-slider" oninput="updateLevelLabel('cold')">
            <span class="level-label" id="coldLevelLabel">약간</span>
          </div>
        </div>
        <div class="option-row">
          <span class="option-label">연속번호 허용</span>
          <label class="toggle"><input type="checkbox" id="optConsec" checked><span class="slider"></span></label>
        </div>
        <div class="num-picker">
          <div class="num-picker-label">
            <span>클릭: 고정 / 더블클릭: 제외</span>
            <button onclick="resetPicker()">초기화</button>
          </div>
          <div class="num-grid" id="numGrid"></div>
          <div class="num-picker-hint" id="pickerStatus">고정: 없음 | 제외: 없음</div>
        </div>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn-primary" id="genBtn" onclick="generateLottoSets()" disabled>✨ 자동 생성</button>
      <button class="btn-primary btn-confirm" id="confirmBtn" onclick="confirmLottoRound()" disabled>🛒 구매 확정</button>
    </div>
    <button class="btn-qr" onclick="openQRScanner()">📷 QR 당첨 확인</button>
  `;
  initNumGrid();
  initSetList();
}

function renderLottoStatsTab() {
  const el = document.getElementById('sub-lotto-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="card-label">전체 통계</div>
      <div class="stat-grid" id="statGrid">
        <div class="stat-box"><div class="skeleton" style="height:48px"></div></div>
        <div class="stat-box"><div class="skeleton" style="height:48px"></div></div>
        <div class="stat-box"><div class="skeleton" style="height:48px"></div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-label">가장 많이 나온 번호 TOP 10</div>
      <div id="hotChart"><div class="skeleton" style="height:180px"></div></div>
    </div>
    <div class="card">
      <div class="card-label">가장 적게 나온 번호 TOP 10</div>
      <div id="coldChart"><div class="skeleton" style="height:180px"></div></div>
    </div>
  `;
}

function renderLottoHistoryTab() {
  const el = document.getElementById('sub-lotto-history');
  if (!el) return;
  el.innerHTML = `
    <div class="card">
      <div class="history-header">
        <div class="card-label" style="margin-bottom:0">생성 히스토리</div>
        <button class="history-clear" onclick="clearHistory('lotto')">전체 삭제</button>
      </div>
      <div id="lottoHistoryList"></div>
    </div>
  `;
  renderHistoryList('lotto');
}

function switchSub(sub) {
  document.querySelectorAll('[data-sub]').forEach(t => {
    t.classList.toggle('active', t.dataset.sub === sub);
  });
  ['lotto-gen', 'lotto-stats', 'lotto-history'].forEach(s => {
    const el = document.getElementById('sub-' + s);
    if (el) el.classList.toggle('hidden', s !== sub);
  });
  if (sub === 'lotto-stats') renderStats();
  if (sub === 'lotto-history') renderLottoHistoryTab();
}

async function initLotto() {
  renderLottoGenTab();
  renderLottoStatsTab();
  await loadData();
  document.getElementById('genBtn')?.removeAttribute('disabled');
  document.getElementById('confirmBtn')?.removeAttribute('disabled');
}
