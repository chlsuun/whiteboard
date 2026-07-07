/* ============================================================
   LiveBoard — app.js (v3 - 무한 캔버스: 팬 + 줌)
   ============================================================ */
// ─────────────────────────────────────────
// 0. 상수 & 세션
// ─────────────────────────────────────────
const SESSION_ID = crypto.randomUUID();
const CURSOR_COLORS = [
  '#6C63FF','#3ECFCF','#F472B6','#FBBF24',
  '#34D399','#F87171','#60A5FA','#A78BFA'
];
const MY_CURSOR_COLOR = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
// ─────────────────────────────────────────
// 1. 전역 상태
// ─────────────────────────────────────────
let db              = null;
let isFirebaseReady = false;
// 드로잉
let isDrawing     = false;
let currentTool   = 'pen';   // 'pen' | 'eraser' | 'pan'
let currentColor  = '#FFFFFF';
let currentWidth  = 5;
let currentStroke = [];
// 스트로크 관리
let localStrokes = [];
let myStrokeIds  = [];
let renderedKeys = new Set();
// ── 뷰포트 (팬 & 줌) ──
let viewport = { x: 0, y: 0, scale: 1 };
// 팬 드래그 상태
let isPanning      = false;
let panStart       = { x: 0, y: 0 };
let panOrigin      = { x: 0, y: 0 };
let isSpaceDown    = false;
let prevTool       = 'pen'; // 스페이스 해제 시 복귀용
// 터치 (핀치 줌)
let activeTouches  = [];
let lastPinchDist  = null;
let lastPinchMid   = null;
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
const canvas         = document.getElementById('whiteboard');
const ctx            = canvas.getContext('2d');
const statusBadge    = document.getElementById('statusBadge');
const statusText     = document.getElementById('statusText');
const userCount      = document.getElementById('userCount');
const cursorsLayer   = document.getElementById('cursorsLayer');
const clearModal     = document.getElementById('clearModal');
const modalCancel    = document.getElementById('modalCancel');
const modalConfirm   = document.getElementById('modalConfirm');
const toastContainer = document.getElementById('toastContainer');
const toolPen        = document.getElementById('toolPen');
const toolEraser     = document.getElementById('toolEraser');
const toolPanBtn     = document.getElementById('toolPan');
const colorSwatches  = document.querySelectorAll('.color-swatch');
const customColor    = document.getElementById('customColor');
const sizeBtns       = document.querySelectorAll('.size-btn');
const btnUndo        = document.getElementById('btnUndo');
const btnClear       = document.getElementById('btnClear');
const btnZoomIn      = document.getElementById('btnZoomIn');
const btnZoomOut     = document.getElementById('btnZoomOut');
const btnResetView   = document.getElementById('btnResetView');
const zoomIndicator  = document.getElementById('zoomIndicator');
// ─────────────────────────────────────────
// 4. 캔버스 크기
// ─────────────────────────────────────────
function resizeCanvas() {
  const container = canvas.parentElement;
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width  = canvas.width;
  tempCanvas.height = canvas.height;
  tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  redrawAll();
}
window.addEventListener('resize', debounce(resizeCanvas, 200));
// ─────────────────────────────────────────
// 5. 좌표 변환
// ─────────────────────────────────────────
// 화면(스크린) → 월드 좌표
function screenToWorld(sx, sy) {
  return {
    x: (sx - viewport.x) / viewport.scale,
    y: (sy - viewport.y) / viewport.scale
  };
}
// 이벤트에서 스크린 좌표 추출
function getScreenPos(e, touchIndex = 0) {
  const rect = canvas.getBoundingClientRect();
  const src  = e.touches ? e.touches[touchIndex] : e;
  return {
    x: src.clientX - rect.left,
    y: src.clientY - rect.top
  };
}
// 이벤트에서 월드 좌표 추출
function getWorldPos(e, touchIndex = 0) {
  const sp = getScreenPos(e, touchIndex);
  return screenToWorld(sp.x, sp.y);
}
// 두 터치 포인트 거리
function getTouchDist(touches) {
  const a = touches[0], b = touches[1];
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}
// 두 터치 포인트 중점 (스크린 좌표)
function getTouchMidScreen(touches) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
  };
}
// ─────────────────────────────────────────
// 6. 줌 & 팬
// ─────────────────────────────────────────
function applyZoom(newScale, pivotSX, pivotSY) {
  newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
  // 피벗 기준으로 줌 (피벗 스크린 좌표 불변 유지)
  viewport.x = pivotSX - (pivotSX - viewport.x) * (newScale / viewport.scale);
  viewport.y = pivotSY - (pivotSY - viewport.y) * (newScale / viewport.scale);
  viewport.scale = newScale;
  updateZoomIndicator();
  redrawAll();
}
function resetView() {
  viewport = { x: 0, y: 0, scale: 1 };
  updateZoomIndicator();
  redrawAll();
}
function updateZoomIndicator() {
  if (zoomIndicator) zoomIndicator.textContent = Math.round(viewport.scale * 100) + '%';
}
// ─────────────────────────────────────────
// 7. 드로잉
// ─────────────────────────────────────────
function startDraw(e) {
  isDrawing = true;
  const pos = getWorldPos(e);
  currentStroke = [pos];
}
function drawContinue(e) {
  if (!isDrawing) return;
  const pos = getWorldPos(e);
  const prev = currentStroke[currentStroke.length - 1];
  currentStroke.push(pos);
  drawSegmentWorld(prev, pos,
    currentTool === 'eraser' ? '#0d0d1a' : currentColor,
    currentTool === 'eraser' ? currentWidth * 4 : currentWidth,
    currentTool
  );
}
function endDraw() {
  if (!isDrawing) return;
  isDrawing = false;
  if (currentStroke.length < 2) {
    currentStroke.push({ x: currentStroke[0].x + 0.5, y: currentStroke[0].y + 0.5 });
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
    const ref = db.ref('whiteboard/strokes').push(strokeData);
    const key = ref.key;
    myStrokeIds.push(key);
    renderedKeys.add(key);
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
// 8. 렌더링 (뷰포트 변환 적용)
// ─────────────────────────────────────────
function drawSegmentWorld(from, to, color, width, tool) {
  if (!from || !to) return;
  ctx.save();
  ctx.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.x, viewport.y);
  ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = color;
  ctx.lineWidth   = width;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}
function renderStroke(stroke) {
  if (!stroke.points || stroke.points.length < 2) return;
  ctx.save();
  ctx.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.x, viewport.y);
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
  ctx.restore();
}
function redrawAll() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  localStrokes.forEach(s => renderStroke(s));
}
// ─────────────────────────────────────────
// 9. 이벤트 핸들러 (마우스)
// ─────────────────────────────────────────
canvas.addEventListener('mousedown', (e) => {
  // 중간 버튼 or 스페이스+좌클릭 or pan 도구
  if (e.button === 1 || isSpaceDown || currentTool === 'pan') {
    e.preventDefault();
    isPanning  = true;
    panStart   = { x: e.clientX, y: e.clientY };
    panOrigin  = { x: viewport.x, y: viewport.y };
    document.body.classList.add('panning');
    return;
  }
  // 좌클릭 → 그리기
  if (e.button === 0 && (currentTool === 'pen' || currentTool === 'eraser')) {
    startDraw(e);
  }
});
canvas.addEventListener('mousemove', (e) => {
  if (isPanning) {
    viewport.x = panOrigin.x + (e.clientX - panStart.x);
    viewport.y = panOrigin.y + (e.clientY - panStart.y);
    redrawAll();
    return;
  }
  if (isDrawing) {
    drawContinue(e);
    if (isFirebaseReady) throttledUpdateCursor(getWorldPos(e));
  }
});
canvas.addEventListener('mouseup', (e) => {
  if (isPanning) {
    isPanning = false;
    document.body.classList.remove('panning');
    if (isSpaceDown) document.body.classList.add('pan-ready');
    return;
  }
  endDraw();
});
canvas.addEventListener('mouseleave', () => {
  if (!isPanning) endDraw();
});
// 마우스 휠 → 줌 (피벗: 마우스 위치)
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const sp = getScreenPos(e);
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  applyZoom(viewport.scale * factor, sp.x, sp.y);
}, { passive: false });
// ─────────────────────────────────────────
// 10. 이벤트 핸들러 (터치 — 아이패드)
// ─────────────────────────────────────────
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  activeTouches = Array.from(e.touches);
  if (e.touches.length === 1) {
    if (currentTool === 'pan') {
      // 1손가락 팬 모드
      isPanning = true;
      const sp  = getScreenPos(e);
      panStart  = sp;
      panOrigin = { x: viewport.x, y: viewport.y };
    } else {
      startDraw(e);
    }
  } else if (e.touches.length === 2) {
    // 2손가락: 그리기 중단 후 핀치/팬
    if (isDrawing) { isDrawing = false; currentStroke = []; redrawAll(); }
    isPanning    = true;
    lastPinchDist = getTouchDist(e.touches);
    lastPinchMid  = getTouchMidScreen(e.touches);
    panOrigin     = { x: viewport.x, y: viewport.y };
  }
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (e.touches.length === 2) {
    // 핀치 줌 + 팬
    const newDist = getTouchDist(e.touches);
    const newMid  = getTouchMidScreen(e.touches);
    if (lastPinchDist) {
      const scaleFactor = newDist / lastPinchDist;
      const newScale    = Math.min(MAX_SCALE, Math.max(MIN_SCALE, viewport.scale * scaleFactor));
      // 줌 (핀치 중점 기준)
      viewport.x = newMid.x - (newMid.x - viewport.x) * (newScale / viewport.scale);
      viewport.y = newMid.y - (newMid.y - viewport.y) * (newScale / viewport.scale);
      viewport.scale = newScale;
      // 팬 (중점 이동)
      viewport.x += newMid.x - lastPinchMid.x;
      viewport.y += newMid.y - lastPinchMid.y;
      updateZoomIndicator();
      redrawAll();
    }
    lastPinchDist = newDist;
    lastPinchMid  = newMid;
    return;
  }
  if (e.touches.length === 1) {
    if (isPanning) {
      // 1손가락 팬
      const sp  = getScreenPos(e);
      viewport.x = panOrigin.x + (sp.x - panStart.x);
      viewport.y = panOrigin.y + (sp.y - panStart.y);
      redrawAll();
    } else {
      drawContinue(e);
    }
  }
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  if (e.touches.length === 0) {
    if (isPanning) {
      isPanning     = false;
      lastPinchDist = null;
      lastPinchMid  = null;
    } else {
      endDraw();
    }
  } else if (e.touches.length === 1) {
    // 손가락 하나 뗐을 때 핀치 해제
    lastPinchDist = null;
    lastPinchMid  = null;
    isPanning     = false;
  }
});
canvas.addEventListener('touchcancel', () => {
  isDrawing     = false;
  isPanning     = false;
  currentStroke = [];
  lastPinchDist = null;
  lastPinchMid  = null;
});
// ─────────────────────────────────────────
// 11. 스페이스 키 → 임시 팬 모드
// ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && !isSpaceDown) {
    isSpaceDown = true;
    document.body.classList.add('pan-ready');
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    isSpaceDown = false;
    isPanning   = false;
    document.body.classList.remove('pan-ready');
    document.body.classList.remove('panning');
  }
});
// ─────────────────────────────────────────
// 12. Firebase 연동
// ─────────────────────────────────────────
function setupFirebase() {
  if (!isFirebaseReady) return;
  const strokesRef  = db.ref('whiteboard/strokes');
  const presenceRef = db.ref('whiteboard/presence/' + SESSION_ID);
  const cursorsRef  = db.ref('whiteboard/cursors');
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
  strokesRef.on('child_added', (snap) => {
    const key    = snap.key;
    const stroke = snap.val();
    if (renderedKeys.has(key)) return;
    renderedKeys.add(key);
    localStrokes.push({ id: key, ...stroke });
    renderStroke(stroke);
  });
  strokesRef.on('child_removed', (snap) => {
    const key = snap.key;
    renderedKeys.delete(key);
    localStrokes = localStrokes.filter(s => s.id !== key);
    redrawAll();
  });
  strokesRef.on('value', (snap) => {
    if (snap.val() === null) {
      renderedKeys.clear();
      localStrokes = [];
      myStrokeIds  = [];
      redrawAll();
    }
  });
  strokesRef.once('value', () => hideLoading());
  db.ref('whiteboard/presence').on('value', (snap) => {
    userCount.textContent = Math.max(snap.numChildren(), 1);
  });
  cursorsRef.on('child_added',   (s) => { if (s.key !== SESSION_ID) createOrUpdateCursor(s.key, s.val()); });
  cursorsRef.on('child_changed', (s) => { if (s.key !== SESSION_ID) createOrUpdateCursor(s.key, s.val()); });
  cursorsRef.on('child_removed', (s) => removeCursor(s.key));
}
// ─────────────────────────────────────────
// 13. 원격 커서
// ─────────────────────────────────────────
const remoteCursors = {};
function createOrUpdateCursor(id, data) {
  if (!data || data.x === undefined) return;
  // 월드 좌표 → 스크린 좌표 변환
  const sx = data.x * viewport.scale + viewport.x;
  const sy = data.y * viewport.scale + viewport.y;
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
  el.style.left = sx + 'px';
  el.style.top  = sy + 'px';
}
function removeCursor(id) {
  if (remoteCursors[id]) { remoteCursors[id].remove(); delete remoteCursors[id]; }
}
const throttledUpdateCursor = throttle((worldPos) => {
  if (!isFirebaseReady) return;
  db.ref('whiteboard/cursors/' + SESSION_ID).set({
    x: worldPos.x, y: worldPos.y,
    color: MY_CURSOR_COLOR,
    timestamp: Date.now()
  });
}, 50);
// ─────────────────────────────────────────
// 14. Undo & Clear
// ─────────────────────────────────────────
function undo() {
  if (myStrokeIds.length === 0) return;
  const lastId = myStrokeIds.pop();
  if (isFirebaseReady && !lastId.startsWith('local_')) {
    db.ref('whiteboard/strokes/' + lastId).remove();
  } else {
    renderedKeys.delete(lastId);
    localStrokes = localStrokes.filter(s => s.id !== lastId);
    redrawAll();
  }
}
function clearAll() {
  if (isFirebaseReady) {
    db.ref('whiteboard/strokes').remove();
  } else {
    renderedKeys.clear();
    localStrokes = [];
    myStrokeIds  = [];
    redrawAll();
  }
}
// ─────────────────────────────────────────
// 15. UI 이벤트
// ─────────────────────────────────────────
function setActiveTool(tool) {
  currentTool = tool;
  toolPen.classList.toggle('active', tool === 'pen');
  toolEraser.classList.toggle('active', tool === 'eraser');
  toolPanBtn.classList.toggle('active', tool === 'pan');
  if (tool === 'pan') {
    canvas.style.cursor = 'grab';
  } else if (tool === 'eraser') {
    canvas.style.cursor = 'cell';
  } else {
    canvas.style.cursor = 'crosshair';
  }
}
toolPen.addEventListener('click',    () => setActiveTool('pen'));
toolEraser.addEventListener('click', () => setActiveTool('eraser'));
toolPanBtn.addEventListener('click', () => setActiveTool('pan'));
colorSwatches.forEach(sw => {
  sw.addEventListener('click', () => {
    currentColor = sw.dataset.color;
    colorSwatches.forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    if (currentTool === 'eraser' || currentTool === 'pan') setActiveTool('pen');
  });
});
customColor.addEventListener('input', (e) => {
  currentColor = e.target.value;
  colorSwatches.forEach(s => s.classList.remove('active'));
  if (currentTool !== 'pen') setActiveTool('pen');
});
sizeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentWidth = parseInt(btn.dataset.size);
    sizeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
btnZoomIn.addEventListener('click', () => {
  applyZoom(viewport.scale * 1.25, canvas.width / 2, canvas.height / 2);
});
btnZoomOut.addEventListener('click', () => {
  applyZoom(viewport.scale * 0.8, canvas.width / 2, canvas.height / 2);
});
btnResetView.addEventListener('click', resetView);
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
// 키보드 단축키
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.key === 'Escape')  clearModal.classList.remove('visible');
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key === 'e') setActiveTool('eraser');
    if (e.key === 'p') setActiveTool('pen');
    if (e.key === 'h') setActiveTool('pan');
    if (e.key === '0') resetView();
    if (e.key === '+' || e.key === '=') applyZoom(viewport.scale * 1.25, canvas.width/2, canvas.height/2);
    if (e.key === '-') applyZoom(viewport.scale * 0.8, canvas.width/2, canvas.height/2);
  }
});
// ─────────────────────────────────────────
// 16. 유틸
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
  const el = document.querySelector('.loading-overlay');
  if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 500); }
}
function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}
function throttle(fn, limit) {
  let busy = false;
  return (...args) => {
    if (!busy) { fn(...args); busy = true; setTimeout(() => busy = false, limit); }
  };
}
function createLoadingOverlay() {
  const el = document.createElement('div');
  el.className = 'loading-overlay';
  el.innerHTML = `<div class="loading-spinner"></div><p class="loading-text">화이트보드를 불러오는 중...</p>`;
  document.body.appendChild(el);
}
// ─────────────────────────────────────────
// 17. 앱 시작
// ─────────────────────────────────────────
function init() {
  createLoadingOverlay();
  const container = canvas.parentElement;
  canvas.width  = container.clientWidth;
  canvas.height = container.clientHeight;
  updateZoomIndicator();
  const ready = initFirebase();
  if (ready) {
    setupFirebase();
  } else {
    hideLoading();
    showToast('오프라인 모드로 실행 중', 'info');
  }
}
document.addEventListener('DOMContentLoaded', init);
