// public/js/history.js
'use strict';

const HISTORY_KEY = {
  lotto: 'lotto_history_lotto',
  pension: 'lotto_history_pension',
};

function getHistory(type) {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY[type]) || '[]'); }
  catch { return []; }
}

function saveHistoryLocal(type, data) {
  const history = getHistory(type);
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  history.unshift({ date: dateStr, data });
  if (history.length > 30) history.length = 30;
  localStorage.setItem(HISTORY_KEY[type], JSON.stringify(history));
}

function clearHistory(type) {
  localStorage.removeItem(HISTORY_KEY[type]);
  renderHistoryList(type);
}

function renderHistoryList(type) {
  const listId = type === 'lotto' ? 'lottoHistoryList' : 'pensionHistoryList';
  const list = document.getElementById(listId);
  if (!list) return;
  const history = getHistory(type);
  if (!history.length) {
    list.innerHTML = '<div class="history-empty">아직 생성 기록이 없습니다</div>';
    return;
  }
  list.innerHTML = history.map(item => {
    const numsHtml = type === 'lotto'
      ? item.data.map(nums => Array.isArray(nums) ? nums.join(', ') : nums).join(' | ')
      : item.data.join(' | ');
    const copyText = type === 'lotto'
      ? item.data.map(nums => Array.isArray(nums) ? nums.join(', ') : nums).join('\n')
      : item.data.join('\n');
    return `<div class="history-item" onclick="copyNums(\`${copyText.replace(/`/g,'\\`')}\`)">
      <div class="history-meta">
        <span class="history-date">${item.date}</span>
        <span class="history-type ${type === 'pension' ? 'pension' : ''}">${type === 'lotto' ? '로또 6/45' : '연금복권'}</span>
      </div>
      <div class="history-nums">${numsHtml}</div>
    </div>`;
  }).join('');
}
