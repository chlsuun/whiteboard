/* ============================================================
   LiveBoard — app.js (v2 - 실시간 동기화 버그 수정)
   ============================================================ */
// ─────────────────────────────────────────
// 0. 상수 & 세션
// ─────────────────────────────────────────
const SESSION_ID = crypto.randomUUID();
const CURSOR_COLORS = [
  '#6C63FF', '#3ECFCF', '#F472B6', '#FBBF24',
  '#34D399', '#F87171', '#60A5FA', '#A78BFA'
];
const MY_CURSOR_COLOR = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
// ─────────────────────────────────────────
// 1. 전역 상태
// ─────────────────────────────────────────
let db              = null;
let isFirebaseReady = false;
let isDrawing       = false;
let currentTool     = 'pen';
let currentColor    = '#FFFFFF';
let currentWidth    = 5;
let currentStroke   = [];
let localStrokes  = [];   // { id, points, color, width, tool }
let myStrokeIds   = [];   // 내가 그린 획의 Firebase key
let renderedKeys  = new Set(); // 이미 캔버스에 그려진 획 key (중복 방지)
// ─────────────────────────────────────────
// 2. Firebase 초기화
// ─────────────────────────────────────────
function initFirebase() {
  try {
    if (typeof firebaseConfig === 'undefined') throw new Error('config 없음');
    if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
      setStatus('오프라인 모드', 'offline');
      showToast('Firebase 설정이 필요합니다', 'info');
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
// 3. DOM 참조
// ─────────────────────────────────────────
const canvas        = document.getElementById('whiteboard');
const ctx           = canvas.getContext('2d');
const statusBadge   = document.getElementById('statusBadge');
const statusText    = document.getElementById('statusText');
const userCount     = document.getElementById('userCount');
const cursorsLayer  = document.getElementById('cursorsLayer');
const clearModal    = document.getElementById('clearModal');
const modalCancel   = document.getElementById('modalCancel');
const modalConfirm  = document.getElementById('modalConfirm');
const toastContainer = document.getElementById('toastContainer');
const toolPen       = document.getElementById('toolPen');
const toolEraser    = document.getElementById('toolEraser');
const colorSwatches = document.querySelectorAll('.color-swatch');
const customColor   = document.getElementById('customColor');
const sizeBtns      = document.querySelectorAll('.size-btn');
const btnUndo       = document.getElementById('btnUndo');
const btnClear      = document.getElementById('btnClear');
// ─────────────────────────────────────────
// 4. 캔버스 크기
// ─────────────────────────────────────────
function resizeCanvas() {
  const container = canvas.parentElement;
  // 기존 내용 저장
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width  = canvas.width;
  tempCanvas.height = canvas.height;
  tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  // 내용 복원
  ctx.drawImage(tempCanvas, 0, 0);
}
window.addEventListener('resize', debounce(resizeCanvas, 200));
// ─────────────────────────────────────────
// 5. 드로잉 이벤트
// ─────────────────────────────────────────
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const src  = e.touches ? e.touches[0] : e;
  return {
    x: src.clientX - rect.left,
    y: src.clientY - rect.top
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
  // 즉각적인 로컬 렌더
  const prev = currentStroke[currentStroke.length - 2];
  drawSegment(prev, pos,
    currentTool === 'eraser' ? '#0d0d1a' : currentColor,
    currentTool === 'eraser' ? currentWidth * 4 : currentWidth,
    currentTool
  );
  if (isFirebaseReady) throttledUpdateCursor(pos);
}
function endDraw() {
  if (!isDrawing) return;
  isDrawing = false;
  if (currentStroke.length < 2) {
    currentStroke.push({ x: currentStroke[0].x + 0.1, y: currentStroke[0].y + 0.1 });
  }
  const strokeData = {
    points:    currentStroke,
    color:     currentTool === 'eraser' ? '#0d0d1a' : currentColor,
    width:     currentTool === 'eraser' ? currentWidth * 4 : currentWidth,
    tool:      currentTool,
    sessionId: SESSION_ID,
    timestamp: Date.now()
  };
  if (isFirebaseReady) {
    // Firebase에 push — key를 즉시 받아서 중복 렌더 방지
    const ref = db.ref('whiteboard/strokes').push(strokeData);
    const key = ref.key;
    myStrokeIds.push(key);
    renderedKeys.add(key);              // ← 핵심: 내가 그린 획은 이미 렌더됐으므로 등록
    localStrokes.push({ id: key, ...strokeData });
  } else {
    const id = 'local_' + Date.now();
    myStrokeIds.push(id);
    renderedKeys.add(id);
    localStrokes.push({ id, ...strokeData });
  }
  currentStroke = [];
}
// ─────────────────────────────────────────
// 6. 렌더링
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
  ctx.lineTo(to.x,   to.y);
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
  localStrokes.forEach(s => renderStroke(s));
}
// ─────────────────────────────────────────
// 7. Firebase 연동 (수정된 버전)
// ─────────────────────────────────────────
function setupFirebase() {
  if (!isFirebaseReady) return;
  const strokesRef  = db.ref('whiteboard/strokes');
  const presenceRef = db.ref('whiteboard/presence/' + SESSION_ID);
  const cursorsRef  = db.ref('whiteboard/cursors');
  // ── 연결 상태 ──
  db.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
      setStatus('실시간 연결됨', 'connected');
      presenceRef.set({ color: MY_CURSOR_COLOR, joinedAt: Date.now() });
      presenceRef.onDisconnect().remove();
      db.ref('whiteboard/cursors/' + SESSION_ID).onDisconnect().remove();
    } else {
      setStatus('재연결 중...', 'error');
    }
  });
  // ── 획 수신: child_added 하나로 기존 + 신규 모두 처리 ──
  // child_added는 기존 데이터 먼저, 이후 새로 추가된 데이터를 순서대로 받음
  strokesRef.on('child_added', (snap) => {
    const key    = snap.key;
    const stroke = snap.val();
    // 이미 렌더된 획이면 스킵 (내가 그린 획 or 중복 이벤트)
    if (renderedKeys.has(key)) return;
    renderedKeys.add(key);
    localStrokes.push({ id: key, ...stroke });
    renderStroke(stroke);
  });
  // ── 획 삭제 감지 (undo 또는 전체 지우기) ──
  strokesRef.on('child_removed', (snap) => {
    const key = snap.key;
    renderedKeys.delete(key);
    localStrokes = localStrokes.filter(s => s.id !== key);
    redrawAll();
  });
  // ── 전체 지우기 감지 (다른 사람이 지운 경우) ──
  strokesRef.on('value', (snap) => {
    if (snap.val() === null) {
      renderedKeys.clear();
      localStrokes = [];
      myStrokeIds  = [];
      redrawAll();
    }
  });
  // 초기 데이터 로드 완료 후 로딩 숨기기
  strokesRef.once('value', () => hideLoading());
  // ── 접속자 수 ──
  db.ref('whiteboard/presence').on('value', (snap) => {
    userCount.textContent = Math.max(snap.numChildren(), 1);
  });
  // ── 원격 커서 ──
  cursorsRef.on('child_added',   (snap) => { if (snap.key !== SESSION_ID) createOrUpdateCursor(snap.key, snap.val()); });
  cursorsRef.on('child_changed', (snap) => { if (snap.key !== SESSION_ID) createOrUpdateCursor(snap.key, snap.val()); });
  cursorsRef.on('child_removed', (snap) => removeCursor(snap.key));
}
// ─────────────────────────────────────────
// 8. 원격 커서
// ─────────────────────────────────────────
const remoteCursors = {};
function createOrUpdateCursor(id, data) {
  if (!data || data.x === undefined) return;
  let el = remoteCursors[id];
  if (!el) {
    el = document.createElement('div');
    el.className = 'remote-cursor';
    el.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20">
        <path d="M4 2L16 10L9 11.5L6.5 18L4 2Z"
          fill="${data.color || '#6C63FF'}" stroke="white"
          stroke-width="1.5" stroke-linejoin="round"/>
      </svg>
      <div class="remote-cursor-label" style="background:${data.color || '#6C63FF'}">참가자</div>
    `;
    cursorsLayer.appendChild(el);
    remoteCursors[id] = el;
  }
  el.style.left = data.x + 'px';
  el.style.top  = data.y + 'px';
}
function removeCursor(id) {
  if (remoteCursors[id]) { remoteCursors[id].remove(); delete remoteCursors[id]; }
}
const throttledUpdateCursor = throttle((pos) => {
  if (!isFirebaseReady) return;
  db.ref('whiteboard/cursors/' + SESSION_ID).set({
    x: pos.x, y: pos.y,
    color: MY_CURSOR_COLOR,
    timestamp: Date.now()
  });
}, 50);
// ─────────────────────────────────────────
// 9. 실행 취소 & 전체 지우기
// ─────────────────────────────────────────
function undo() {
  if (myStrokeIds.length === 0) return;
  const lastId = myStrokeIds.pop();
  if (isFirebaseReady && !lastId.startsWith('local_')) {
    db.ref('whiteboard/strokes/' + lastId).remove();
    // child_removed 이벤트가 로컬도 처리함
  } else {
    renderedKeys.delete(lastId);
    localStrokes = localStrokes.filter(s => s.id !== lastId);
    redrawAll();
  }
}
function clearAll() {
  if (isFirebaseReady) {
    db.ref('whiteboard/strokes').remove();
    // value 이벤트(null)가 로컬도 처리함
  } else {
    renderedKeys.clear();
    localStrokes = [];
    myStrokeIds  = [];
    redrawAll();
  }
}
// ─────────────────────────────────────────
// 10. UI 이벤트
// ─────────────────────────────────────────
canvas.addEventListener('mousedown',  startDraw);
canvas.addEventListener('mousemove',  draw);
canvas.addEventListener('mouseup',    endDraw);
canvas.addEventListener('mouseleave', endDraw);
canvas.addEventListener('touchstart',  startDraw, { passive: false });
canvas.addEventListener('touchmove',   draw,      { passive: false });
canvas.addEventListener('touchend',    endDraw);
canvas.addEventListener('touchcancel', endDraw);
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
  canvas.style.cursor = 'cell';
});
colorSwatches.forEach(sw => {
  sw.addEventListener('click', () => {
    currentColor = sw.dataset.color;
    colorSwatches.forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    if (currentTool === 'eraser') toolPen.click();
  });
});
customColor.addEventListener('input', (e) => {
  currentColor = e.target.value;
  colorSwatches.forEach(s => s.classList.remove('active'));
  if (currentTool === 'eraser') toolPen.click();
});
sizeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentWidth = parseInt(btn.dataset.size);
    sizeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
btnUndo.addEventListener('click', undo);
btnClear.addEventListener('click', () => clearModal.classList.add('visible'));
modalCancel.addEventListener('click', () => clearModal.classList.remove('visible'));
modalConfirm.addEventListener('click', () => {
  clearModal.classList.remove('visible');
  clearAll();
  showToast('화이트보드가 초기화되었습니다', 'success');
});
clearModal.addEventListener('click', (e) => {
  if (e.target === clearModal) clearModal.classList.remove('visible');
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.key === 'Escape') clearModal.classList.remove('visible');
  if (!e.ctrlKey && !e.metaKey) {
    if (e.key === 'e') toolEraser.click();
    if (e.key === 'p') toolPen.click();
  }
});
// ─────────────────────────────────────────
// 11. 유틸
// ─────────────────────────────────────────
function setStatus(text, type) {
  statusText.textContent = text;
  statusBadge.className  = 'status-badge ' + type;
}
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
function hideLoading() {
  const overlay = document.querySelector('.loading-overlay');
  if (overlay) { overlay.classList.add('hidden'); setTimeout(() => overlay.remove(), 500); }
}
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
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
function createLoadingOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `<div class="loading-spinner"></div><p class="loading-text">화이트보드를 불러오는 중...</p>`;
  document.body.appendChild(overlay);
}
// ─────────────────────────────────────────
// 12. 앱 시작
// ─────────────────────────────────────────
function init() {
  createLoadingOverlay();
  const container = canvas.parentElement;
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  const ready = initFirebase();
  if (ready) {
    setupFirebase();
  } else {
    hideLoading();
    showToast('오프라인 모드로 실행 중', 'info');
  }
}
document.addEventListener('DOMContentLoaded', init);
