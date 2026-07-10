/* ============================================================
   LiveBoard — Premium Dark Whiteboard
   ============================================================ */
/* ── CSS 변수 ── */
:root {
  --bg-deep:       #0d0d1a;
  --bg-surface:    #12122b;
  --bg-card:       #1a1a3a;
  --glass-bg:      rgba(255, 255, 255, 0.06);
  --glass-border:  rgba(255, 255, 255, 0.12);
  --glass-hover:   rgba(255, 255, 255, 0.10);
  --accent-purple: #6C63FF;
  --accent-cyan:   #3ECFCF;
  --accent-pink:   #F472B6;
  --accent-red:    #F87171;
  --text-primary:  #F0F0FF;
  --text-secondary:#9090B8;
  --text-muted:    #505078;
  --toolbar-h: 72px;
  --header-h:  54px;
  --radius-lg: 18px;
  --radius-md: 12px;
  --radius-sm: 8px;
  --shadow-glow: 0 0 30px rgba(108, 99, 255, 0.15);
  --shadow-card: 0 8px 32px rgba(0, 0, 0, 0.4);
  --transition:  all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
/* ── 리셋 ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 100%; height: 100%;
  overflow: hidden;
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--bg-deep);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}
/* ── 배경 그라디언트 ── */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse 800px 600px at 20% 10%, rgba(108,99,255,0.12) 0%, transparent 60%),
    radial-gradient(ellipse 600px 500px at 80% 80%, rgba(62,207,207,0.08) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}
/* ── 헤더 ── */
.header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: rgba(13, 13, 26, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--glass-border);
  z-index: 100;
}
.header-left, .header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
/* 로고 */
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}
.logo-icon {
  width: 28px; height: 28px;
  border-radius: 8px;
  filter: drop-shadow(0 0 8px rgba(108,99,255,0.5));
}
.logo-text {
  font-size: 17px;
  font-weight: 700;
  background: linear-gradient(90deg, #6C63FF, #3ECFCF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.3px;
}
/* 상태 배지 */
.status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: var(--transition);
}
.status-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: var(--transition);
}
.status-badge.connected .status-dot {
  background: #34D399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.6);
  animation: pulse-dot 2s infinite;
}
.status-badge.connected .status-text {
  color: #34D399;
}
.status-badge.error .status-dot {
  background: var(--accent-red);
}
.status-badge.error .status-text {
  color: var(--accent-red);
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
/* 유저 배지 */
.users-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}
.users-badge svg {
  width: 14px; height: 14px;
  color: var(--accent-cyan);
}
/* ── 저장 버튼 ── */
.save-wrapper {
  position: relative;
}
.save-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: linear-gradient(135deg, rgba(108,99,255,0.3), rgba(62,207,207,0.2));
  border: 1px solid rgba(108,99,255,0.5);
  border-radius: 20px;
  color: #C0BDFF;
  font-size: 13px;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: var(--transition);
  white-space: nowrap;
}
.save-btn svg {
  width: 15px; height: 15px;
  stroke: currentColor;
  flex-shrink: 0;
}
.save-btn:hover {
  background: linear-gradient(135deg, rgba(108,99,255,0.5), rgba(62,207,207,0.35));
  border-color: rgba(108,99,255,0.8);
  color: white;
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(108,99,255,0.25);
}
/* 드롭다운 패널 */
.save-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: #1a1a3a;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  transform: translateY(-6px) scale(0.97);
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 200;
}
.save-dropdown.visible {
  opacity: 1;
  pointer-events: all;
  transform: translateY(0) scale(1);
}
.save-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s ease;
  font-family: 'Inter', sans-serif;
  text-align: left;
}
.save-option:hover {
  background: var(--glass-bg);
}
.save-option:not(:last-child) {
  border-bottom: 1px solid var(--glass-border);
}
.save-option-icon {
  width: 36px; height: 36px;
  background: rgba(108,99,255,0.15);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #A5A0FF;
}
.save-option-icon svg {
  width: 18px; height: 18px;
}
.save-option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.save-option-text strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.save-option-text span {
  font-size: 11px;
  color: var(--text-secondary);
}
/* 이미지 업로드 버튼 */
.image-upload-btn {
  cursor: pointer;
  position: relative;
  background: rgba(62, 207, 207, 0.1);
  border-color: rgba(62, 207, 207, 0.4);
  color: #3ECFCF;
}
.image-upload-btn:hover {
  background: rgba(62, 207, 207, 0.2);
  border-color: rgba(62, 207, 207, 0.7);
  color: #7FFFFF;
}
/* 드래그 앤 드롭 오버레이 */
.drop-overlay {
  position: fixed;
  inset: 0;
  background: rgba(108, 99, 255, 0.15);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 400;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.drop-overlay.active {
  opacity: 1;
  pointer-events: all;
}
.drop-overlay-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: #A5A0FF;
}
.drop-overlay-inner svg {
  width: 80px; height: 80px;
  animation: float 2s ease-in-out infinite;
}
.drop-overlay-inner p {
  font-size: 22px;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 12px rgba(108,99,255,0.5);
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-8px); }
}
.canvas-container {
  position: fixed;
  top: var(--header-h);
  left: 0; right: 0;
  bottom: var(--toolbar-h);
  overflow: hidden;
  z-index: 1;
}
#whiteboard {
  display: block;
  width: 100%; height: 100%;
  cursor: crosshair;
  touch-action: none;
}
/* 커서 레이어 */
.cursors-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}
.remote-cursor {
  position: absolute;
  pointer-events: none;
  transform: translate(-2px, -2px);
  transition: left 0.05s linear, top 0.05s linear;
}
.remote-cursor svg {
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
}
.remote-cursor-label {
  position: absolute;
  top: 22px; left: 8px;
  background: rgba(0,0,0,0.7);
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
/* ── 툴바 ── */
.toolbar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: var(--toolbar-h);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 16px;
  background: rgba(13, 13, 26, 0.9);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-top: 1px solid var(--glass-border);
  z-index: 100;
  overflow-x: auto;
  scrollbar-width: none;
}
.toolbar::-webkit-scrollbar { display: none; }
/* 구분선 */
.toolbar-divider {
  width: 1px;
  height: 32px;
  background: var(--glass-border);
  flex-shrink: 0;
  margin: 0 4px;
}
/* 도구 버튼 */
.tool-btn {
  width: 44px; height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
  flex-shrink: 0;
}
.tool-btn svg {
  width: 18px; height: 18px;
  stroke: currentColor;
}
.tool-btn:hover {
  background: var(--glass-hover);
  color: var(--text-primary);
  border-color: rgba(255,255,255,0.2);
  transform: translateY(-1px);
}
.tool-btn.active {
  background: rgba(108, 99, 255, 0.2);
  border-color: rgba(108, 99, 255, 0.6);
  color: #A5A0FF;
  box-shadow: 0 0 14px rgba(108, 99, 255, 0.2);
}
.tool-btn.danger:hover {
  background: rgba(248, 113, 113, 0.15);
  border-color: rgba(248, 113, 113, 0.5);
  color: var(--accent-red);
}
/* 색상 팔레트 */
.color-palette {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.color-swatch {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: var(--transition);
  flex-shrink: 0;
  outline: none;
  position: relative;
}
.color-swatch:hover {
  transform: scale(1.15);
}
.color-swatch.active {
  border-color: rgba(255,255,255,0.9);
  box-shadow: 0 0 0 2px rgba(255,255,255,0.3), 0 0 12px rgba(255,255,255,0.2);
  transform: scale(1.1);
}
/* 커스텀 색상 피커 */
.color-picker-label {
  width: 36px; height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.color-picker-label svg {
  width: 18px; height: 18px;
  pointer-events: none;
}
.color-picker-label:hover {
  background: var(--glass-hover);
  transform: translateY(-1px);
}
.color-picker-label input[type="color"] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%; height: 100%;
}
/* 브러시 크기 그룹 */
.brush-size-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.size-btn {
  width: 38px; height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}
.size-dot {
  border-radius: 50%;
  background: var(--text-secondary);
  transition: var(--transition);
}
.size-btn:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border);
}
.size-btn:hover .size-dot {
  background: var(--text-primary);
}
.size-btn.active {
  background: rgba(108, 99, 255, 0.15);
  border-color: rgba(108, 99, 255, 0.5);
}
.size-btn.active .size-dot {
  background: #A5A0FF;
}
/* ── 모달 ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}
.modal-overlay.visible {
  opacity: 1;
  pointer-events: all;
}
.modal {
  background: #1a1a3a;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 36px 32px;
  max-width: 360px;
  width: calc(100% - 32px);
  text-align: center;
  box-shadow: var(--shadow-card), 0 0 60px rgba(248,113,113,0.1);
  transform: scale(0.92) translateY(10px);
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-overlay.visible .modal {
  transform: scale(1) translateY(0);
}
.modal-icon {
  width: 56px; height: 56px;
  background: rgba(248, 113, 113, 0.12);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}
.modal-icon svg {
  width: 28px; height: 28px;
}
.modal h2 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--text-primary);
}
.modal p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 28px;
}
.modal-actions {
  display: flex;
  gap: 10px;
}
.modal-btn {
  flex: 1;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  border: none;
  font-family: 'Inter', sans-serif;
}
.modal-btn.cancel {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
}
.modal-btn.cancel:hover {
  background: var(--glass-hover);
  color: var(--text-primary);
}
.modal-btn.confirm {
  background: linear-gradient(135deg, #F87171, #EF4444);
  color: white;
  box-shadow: 0 4px 16px rgba(248,113,113,0.3);
}
.modal-btn.confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(248,113,113,0.4);
}
/* ── Toast ── */
.toast-container {
  position: fixed;
  top: calc(var(--header-h) + 12px);
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 300;
}
.toast {
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: var(--shadow-card);
  animation: slideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  max-width: 260px;
}
.toast.success { background: linear-gradient(135deg, #059669, #34D399); }
.toast.error   { background: linear-gradient(135deg, #DC2626, #F87171); }
.toast.info    { background: linear-gradient(135deg, #4F46E5, #6C63FF); }
.toast.fade-out {
  animation: slideOut 0.3s ease forwards;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateX(100%); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes slideOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(100%); }
}
/* ── 로딩 오버레이 ── */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-deep);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 500;
  transition: opacity 0.5s ease;
}
.loading-overlay.hidden {
  opacity: 0;
  pointer-events: none;
}
.loading-spinner {
  width: 48px; height: 48px;
  border: 3px solid var(--glass-border);
  border-top-color: var(--accent-purple);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.loading-text {
  font-size: 14px;
  color: var(--text-secondary);
}
/* ── 줌 인디케이터 ── */
.zoom-indicator {
  padding: 4px 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 50px;
  text-align: center;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.3px;
}
/* 팬 모드 커서 */
body.panning        { cursor: grabbing !important; }
body.panning canvas { cursor: grabbing !important; }
body.pan-ready        { cursor: grab !important; }
body.pan-ready canvas { cursor: grab !important; }
/* ── 반응형 (모바일 / 아이패드) ── */
@media (max-width: 768px) {
  .toolbar {
    gap: 4px;
    padding: 0 8px;
  }
  .tool-btn {
    width: 40px; height: 40px;
  }
  .color-swatch {
    width: 22px; height: 22px;
  }
  .color-picker-label {
    width: 32px; height: 32px;
  }
  .size-btn {
    width: 32px; height: 32px;
  }
}
@media (max-width: 480px) {
  .users-badge {
    display: none;
  }
}
