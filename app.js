/* ============================================================
   LiveBoard — app.js
   실시간 화이트보드 로직 + Firebase Realtime Database 연동
   ============================================================ */

// ─────────────────────────────────────────
// 0. 상수 & 유틸
// ─────────────────────────────────────────
const SESSION_ID   = crypto.randomUUID();          // 이 세션의 고유 ID
const CURSOR_COLORS = [
  '#6C63FF', '#3ECFCF', '#F472B6', '#FBBF24',
  '#34D399', '#F87171', '#60A5FA', '#A78BFA'
];
const MY_CURSOR_COLOR = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];

// ─────────────────────────────────────────
// 1. Firebase 초기화
// ─────────────────────────────────────────
let db = null;
let isFirebaseReady = false;

function initFirebase() {
  try {
    if (typeof firebaseConfig === 'undefined') {
      throw new Error('firebase-config.js가 로드되지 않았습니다');
    }
    if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
      console.warn('⚠️ Firebase config가 설정되지 않았습니다. 오프라인 모드로 실행됩니다.');
      setStatus('오프라인 모드', 'offline');
      showToast('Firebase 설정이 필요합니다. firebase-config.js를 설정해주세요.', 'info');
      return false;
    }

    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    isFirebaseReady = true;
    return true;
  } catch (e) {
    console.error('Firebase 초기화 실패:', e);
    setStatus('연결 실패', 'error');
    return false;
  }
}

// ─────────────────────────────────────────
// 2. DOM 요소 참조
// ─────────────────────────────────────────
const canvas       = document.getElementById('whiteboard');
const ctx          = canvas.getContext('2d');
const statusBadge  = document.getElementById('statusBadge');
const statusDot    = document.getElementById('statusDot');
const statusText   = document.getElementById('statusText');
const userCount    = document.getElementById('userCount');
const cursorsLayer = document.getElementById('cursorsLayer');
const clearModal   = document.getElementById('clearModal');
const modalCancel  = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const toastContainer = document.getElementById('toastContainer');

// 툴바 요소
const toolPen      = document.getElementById('toolPen');
const toolEraser   = document.getElementById('toolEraser');
const colorSwatches = document.querySelectorAll('.color-swatch');
const customColor  = document.getElementById('customColor');
const sizeBtns     = document.querySelectorAll('.size-btn');
const btnUndo      = document.getElementById('btnUndo');
const btnClear     = document.getElementById('btnClear');

// ─────────────────────────────────────────
// 3. 캔버스 크기 동기화
// ─────────────────────────────────────────
function resizeCanvas() {
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight;

  // 현재 캔버스 내용을 임시 저장
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  canvas.width  = w;
  canvas.height = h;

  // 내용 복원 (리사이즈 시 캔버스가 지워지므로)
  ctx.putImageData(imageData, 0, 0);

  // 전체 재렌더
  redrawAll();
}

window.addEventListener('resize', debounce(resizeCanvas, 200));

// ─────────────────────────────────────────
// 4. 드로잉 상태
// ─────────────────────────────────────────
let isDrawing    = false;
let currentTool  = 'pen';   // 'pen' | 'eraser'
let currentColor = '#FFFFFF';
let currentWidth = 5;
let currentStroke = [];     // 현재 그리는 획의 포인트 배열

// 로컬 획 배열 (undo용)
let localStrokes = [];      // [{ id, points, color, width, tool }]
let myStrokeIds  = [];      // 내가 그린 획의 Firebase key 배열

// ─────────────────────────────────────────
// 5. 그리기 이벤트
// ─────────────────────────────────────────

// 좌표 추출 (마우스 & 터치 통합)
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  if (e.touches && e.touches.length > 0) {
    return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
  }
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function startDraw(e) {
  isDrawing = true;
  const pos = getPos(e);
  currentStroke = [pos];

  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();

  const pos = getPos(e);
  currentStroke.push(pos);

  // 로컬 즉시 렌더 (부드럽게)
  drawSegment(
    currentStroke[currentStroke.length - 2],
    pos,
    currentTool === 'eraser' ? '#0d0d1a' : currentColor,
    currentTool === 'eraser' ? currentWidth * 4 : currentWidth,
    currentTool
  );

  // 커서 위치 브로드캐스트
  if (isFirebaseReady) {
    throttledUpdateCursor(pos);
  }
}

function endDraw() {
  if (!isDrawing) return;
  isDrawing = false;

  if (currentStroke.length < 2) {
    // 단순 클릭 → 점 찍기
    currentStroke.push({
      x: currentStroke[0].x + 0.1,
      y: currentStroke[0].y + 0.1
    });
  }

  const strokeData = {
    points: currentStroke,
    color: currentTool === 'eraser' ? '#0d0d1a' : currentColor,
    width: currentTool === 'eraser' ? currentWidth * 4 : currentWidth,
    tool: currentTool,
    sessionId: SESSION_ID,
    timestamp: Date.now()
  };

  // Firebase에 저장 (실시간 동기화)
  if (isFirebaseReady) {
    const ref = db.ref('whiteboard/strokes').push(strokeData);
    myStrokeIds.push(ref.key);
  } else {
    // 오프라인 모드 - 로컬만
    const id = 'local_' + Date.now();
    localStrokes.push({ id, ...strokeData });
    myStrokeIds.push(id);
  }

  currentStroke = [];
}

// ─────────────────────────────────────────
// 6. 캔버스 렌더링
// ─────────────────────────────────────────

function drawSegment(from, to, color, width, tool) {
  if (!from || !to) return;

  ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
}

function renderStroke(stroke) {
  if (!stroke.points || stroke.points.length < 2) return;

  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth   = stroke.width;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
}

function redrawAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  localStrokes.forEach(stroke => renderStroke(stroke));
}

// ─────────────────────────────────────────
// 7. Firebase 연동
// ─────────────────────────────────────────

function setupFirebase() {
  if (!isFirebaseReady) return;

  const strokesRef = db.ref('whiteboard/strokes');
  const presenceRef = db.ref('whiteboard/presence/' + SESSION_ID);
  const cursorsRef  = db.ref('whiteboard/cursors');

  // ── 연결 상태 모니터링 ──
  db.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
      setStatus('실시간 연결됨', 'connected');

      // 접속자 등록 (연결 끊기면 자동 삭제)
      presenceRef.set({
        color: MY_CURSOR_COLOR,
        joinedAt: Date.now()
      });
      presenceRef.onDisconnect().remove();

      // 커서도 연결 끊기면 삭제
      db.ref('whiteboard/cursors/' + SESSION_ID).onDisconnect().remove();
    } else {
      setStatus('재연결 중...', 'error');
    }
  });

  // ── 기존 획 불러오기 (초기 로드) ──
  strokesRef.once('value', (snap) => {
    const data = snap.val();
    if (data) {
      Object.entries(data).forEach(([key, stroke]) => {
        localStrokes.push({ id: key, ...stroke });
      });
      redrawAll();
    }
    hideLoading();
  }).catch(() => hideLoading());

  // ── 새 획 실시간 수신 ──
  const existingIds = new Set(localStrokes.map(s => s.id));

  strokesRef.on('child_added', (snap) => {
    const key    = snap.key;
    const stroke = snap.val();

    // 이미 로컬에 있는 획이면 스킵 (초기 로드 중복 방지)
    if (existingIds.has(key)) return;
    existingIds.add(key);

    localStrokes.push({ id: key, ...stroke });
    renderStroke(stroke);
  });

  // ── 획 삭제 (전체 지우기) ──
  strokesRef.on('child_removed', () => {
    // 다른 사람이 전체 지운 경우
    localStrokes = [];
    myStrokeIds  = [];
    redrawAll();
  });

  // 전체 value 감시 (전체 삭제 감지)
  strokesRef.on('value', (snap) => {
    if (!snap.val() && localStrokes.length > 0) {
      localStrokes = [];
      myStrokeIds  = [];
      redrawAll();
    }
  });

  // ── 접속자 수 모니터링 ──
  db.ref('whiteboard/presence').on('value', (snap) => {
    const count = snap.numChildren();
    userCount.textContent = Math.max(count, 1);
  });

  // ── 원격 커서 수신 ──
  cursorsRef.on('child_added', (snap) => {
    if (snap.key !== SESSION_ID) {
      createOrUpdateCursor(snap.key, snap.val());
    }
  });

  cursorsRef.on('child_changed', (snap) => {
    if (snap.key !== SESSION_ID) {
      createOrUpdateCursor(snap.key, snap.val());
    }
  });

  cursorsRef.on('child_removed', (snap) => {
    removeCursor(snap.key);
  });
}

// ─────────────────────────────────────────
// 8. 원격 커서 렌더링
// ─────────────────────────────────────────

const remoteCursors = {};

function createOrUpdateCursor(id, data) {
  if (!data || !data.x) return;

  let el = remoteCursors[id];
  if (!el) {
    el = document.createElement('div');
    el.className = 'remote-cursor';
    el.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20">
        <path d="M4 2L16 10L9 11.5L6.5 18L4 2Z"
          fill="${data.color || '#6C63FF'}"
          stroke="white" stroke-width="1.5"
          stroke-linejoin="round"/>
      </svg>
      <div class="remote-cursor-label" style="background:${data.color || '#6C63FF'}">
        ${data.label || '사용자'}
      </div>
    `;
    cursorsLayer.appendChild(el);
    remoteCursors[id] = el;
  }

  el.style.left = data.x + 'px';
  el.style.top  = data.y + 'px';
}

function removeCursor(id) {
  if (remoteCursors[id]) {
    remoteCursors[id].remove();
    delete remoteCursors[id];
  }
}

// ─────────────────────────────────────────
// 9. 커서 위치 브로드캐스트 (쓰로틀)
// ─────────────────────────────────────────

const throttledUpdateCursor = throttle((pos) => {
  if (!isFirebaseReady) return;
  db.ref('whiteboard/cursors/' + SESSION_ID).set({
    x: pos.x,
    y: pos.y,
    color: MY_CURSOR_COLOR,
    label: '나',
    timestamp: Date.now()
  });
}, 50); // 50ms 간격으로 전송 (20fps)

// ─────────────────────────────────────────
// 10. 실행 취소 (Undo)
// ─────────────────────────────────────────

function undo() {
  if (myStrokeIds.length === 0) return;

  const lastId = myStrokeIds.pop();

  if (isFirebaseReady && !lastId.startsWith('local_')) {
    db.ref('whiteboard/strokes/' + lastId).remove();
  }

  localStrokes = localStrokes.filter(s => s.id !== lastId);
  redrawAll();
}

// ─────────────────────────────────────────
// 11. 전체 지우기
// ─────────────────────────────────────────

function clearAll() {
  if (isFirebaseReady) {
    db.ref('whiteboard/strokes').remove();
  }
  localStrokes = [];
  myStrokeIds  = [];
  redrawAll();
}

// ─────────────────────────────────────────
// 12. UI 이벤트 리스너
// ─────────────────────────────────────────

// 캔버스 — 마우스
canvas.addEventListener('mousedown',  startDraw);
canvas.addEventListener('mousemove',  draw);
canvas.addEventListener('mouseup',    endDraw);
canvas.addEventListener('mouseleave', endDraw);

// 캔버스 — 터치 (아이패드 지원)
canvas.addEventListener('touchstart',  startDraw, { passive: false });
canvas.addEventListener('touchmove',   draw,      { passive: false });
canvas.addEventListener('touchend',    endDraw);
canvas.addEventListener('touchcancel', endDraw);

// 도구 선택
toolPen.addEventListener('click', () => {
  currentTool = 'pen';
  toolPen.classList.add('active');
  toolEraser.classList.remove('active');
  canvas.style.cursor = 'crosshair';
});

toolEraser.addEventListener('click', () => {
  currentTool = 'eraser';
  toolEraser.classList.add('active');
  toolPen.classList.remove('active');
  canvas.style.cursor = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Crect width='20' height='14' x='2' y='5' rx='2' fill='white' fill-opacity='0.5' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E\") 12 12, cell";
});

// 색상 스와치
colorSwatches.forEach(swatch => {
  swatch.addEventListener('click', () => {
    currentColor = swatch.dataset.color;
    colorSwatches.forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    // 펜 모드로 전환
    if (currentTool === 'eraser') toolPen.click();
  });
});

// 커스텀 색상
customColor.addEventListener('input', (e) => {
  currentColor = e.target.value;
  colorSwatches.forEach(s => s.classList.remove('active'));
  if (currentTool === 'eraser') toolPen.click();
});

// 브러시 크기
sizeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentWidth = parseInt(btn.dataset.size);
    sizeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// 실행취소
btnUndo.addEventListener('click', undo);

// 전체 지우기
btnClear.addEventListener('click', () => {
  clearModal.classList.add('visible');
});

modalCancel.addEventListener('click', () => {
  clearModal.classList.remove('visible');
});

modalConfirm.addEventListener('click', () => {
  clearModal.classList.remove('visible');
  clearAll();
  showToast('화이트보드가 초기화되었습니다', 'success');
});

// 모달 배경 클릭 닫기
clearModal.addEventListener('click', (e) => {
  if (e.target === clearModal) clearModal.classList.remove('visible');
});

// 키보드 단축키
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    undo();
  }
  if (e.key === 'Escape') {
    clearModal.classList.remove('visible');
  }
  if (e.key === 'e' && !e.ctrlKey && !e.metaKey) {
    toolEraser.click();
  }
  if (e.key === 'p' && !e.ctrlKey && !e.metaKey) {
    toolPen.click();
  }
});

// ─────────────────────────────────────────
// 13. 유틸 함수
// ─────────────────────────────────────────

function setStatus(text, type) {
  statusText.textContent = text;
  statusBadge.className  = 'status-badge ' + type;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '✓',
    error:   '✕',
    info:    'ℹ'
  };

  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function hideLoading() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => overlay.remove(), 500);
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function throttle(fn, limit) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ─────────────────────────────────────────
// 14. 로딩 오버레이 생성
// ─────────────────────────────────────────

function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <p class="loading-text">화이트보드를 불러오는 중...</p>
  `;
  document.body.appendChild(overlay);
}

// ─────────────────────────────────────────
// 15. 앱 초기화
// ─────────────────────────────────────────

function init() {
  createLoadingOverlay();

  // 캔버스 초기 크기 설정
  const container = canvas.parentElement;
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;

  // Firebase 초기화
  const ready = initFirebase();

  if (ready) {
    setupFirebase();
  } else {
    // 오프라인 모드로 즉시 사용 가능
    hideLoading();
    showToast('오프라인 모드: Firebase를 설정하면 실시간 동기화가 활성화됩니다', 'info');
  }
}

// DOM 준비 후 실행
document.addEventListener('DOMContentLoaded', init);
