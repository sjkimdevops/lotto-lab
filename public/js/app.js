// public/js/app.js
'use strict';

const NAV_SECTIONS = {
  lotto:   'section-lotto',
  pension: 'section-pension',
  my:      'section-my',
};

let currentNav = 'lotto';

function switchNav(section) {
  currentNav = section;

  Object.entries(NAV_SECTIONS).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', key !== section);
  });

  ['lotto', 'pension', 'my'].forEach(name => {
    const btn = document.getElementById('nav' + name.charAt(0).toUpperCase() + name.slice(1));
    if (btn) btn.classList.toggle('active', name === section);
  });

  if (section === 'my') renderMyPage();
}

function copyNums(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('copyToast');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1500);
  });
}

function renderMyPage() {
  const el = document.getElementById('section-my');
  if (!el) return;
  el.innerHTML = `
    <div class="header" style="margin-bottom:1rem">
      <h1 style="font-size:1.4rem">마이</h1>
    </div>
    <div class="card" id="myProfileCard">
      <div class="my-login-prompt">
        <div style="font-size:2.2rem;margin-bottom:.65rem">👤</div>
        <div style="font-size:.95rem;font-weight:700;margin-bottom:.35rem">로그인이 필요합니다</div>
        <div style="font-size:.78rem;color:var(--text3);line-height:1.65;margin-bottom:1rem">
          로그인하면 번호 히스토리가<br>모든 기기에서 동기화됩니다
        </div>
        <button class="btn-primary" onclick="openLoginModal()" style="max-width:240px;margin:0 auto">
          로그인하기
        </button>
      </div>
    </div>
    <div class="card" style="opacity:0.35;pointer-events:none">
      <div class="card-label">최근 생성 기록</div>
      <div style="font-size:.8rem;color:var(--text3);text-align:center;padding:1rem 0">
        로그인 후 확인 가능합니다
      </div>
    </div>`;
}

// --- 로그인 모달 ---
function openLoginModal() {
  let modal = document.getElementById('loginModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.className = 'login-modal-overlay';
    modal.innerHTML = `
      <div class="login-modal">
        <button class="login-modal-close" onclick="closeLoginModal()">✕</button>
        <div style="font-size:2.6rem;margin-bottom:.5rem">🎰</div>
        <h1 style="font-size:1.6rem;font-weight:800;background:linear-gradient(90deg,var(--accent),var(--gold));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.35rem">복권월드</h1>
        <p style="font-size:.78rem;color:var(--text3);line-height:1.7;margin-bottom:1.6rem;text-align:center">
          로그인하면 번호 히스토리가<br>모든 기기에서 동기화됩니다
        </p>
        <div style="width:100%;max-width:300px">
          <button class="btn-google" onclick="signInWithGoogle()">
            <span style="font-size:1.1rem;font-weight:700;color:#4285F4">G</span>
            Google로 계속하기
          </button>
          <div class="login-divider"><span>추후 추가 예정</span></div>
          <button class="btn-social-future" disabled>
            <span>💬</span> 카카오로 로그인
          </button>
          <button class="btn-social-future" disabled style="margin-top:.4rem">
            <span style="color:#03C75A;font-weight:700">N</span> 네이버로 로그인
          </button>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) closeLoginModal(); });
    document.body.appendChild(modal);
  }
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('show');
  document.body.style.overflow = '';
}

function signInWithGoogle() {
  alert('Firebase 연동 후 사용 가능합니다 (Phase 2)');
}

document.addEventListener('DOMContentLoaded', () => {
  initLotto();
  initPension();
});
