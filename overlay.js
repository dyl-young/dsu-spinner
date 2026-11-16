// Floating spinner panel, injected into the current page when the toolbar icon is clicked.
// Its mode and position live in this tab's sessionStorage.
// Modes: "dock" (right edge, full height), "big" (centred, for screensharing),
//        "float" (wherever it was dragged to).
(() => {
  if (window.__dsuSpinner) return;
  if (window.top !== window) return;

  const ORIGIN = new URL(chrome.runtime.getURL('')).origin;
  const SRC = chrome.runtime.getURL('spinner.html');
  const KEY = 'dsuSpinnerOverlay';
  const MARGIN = 12;
  const MIN_W = 300; // minimised: just the header bar
  const MIN_H = 56;
  const DOCK_W = 380;
  let contentH = 0; // height the spinner page reports; the small panel fits it

  const readPrefs = () => {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  let prefs = { mode: 'dock', rect: null, min: false, ...readPrefs() };
  const savePrefs = () => {
    try { sessionStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  };

  let wrap = null;
  let frame = null;
  let shield = null;

  const css = `
    :host { all: initial; }
    .wrap {
      position: fixed; z-index: 2147483646;
      border-radius: 14px; overflow: hidden;
      background: #131518;
      box-shadow: 0 18px 60px rgba(0,0,0,.4);
      transition: opacity 180ms, transform 220ms cubic-bezier(.2,.8,.2,1);
    }
    .wrap.dock  { top: ${MARGIN}px; right: ${MARGIN}px; bottom: ${MARGIN}px; width: ${DOCK_W}px; max-width: calc(100vw - ${MARGIN * 2}px); }
    .wrap.dock.fit { bottom: auto; }
    .wrap.big   { top: 4vh; bottom: 4vh; left: 50%; width: min(1280px, 94vw); transform: translateX(-50%); }
    .wrap.hidden { opacity: 0; pointer-events: none; transform: translateY(8px); }
    .wrap.big.hidden { transform: translate(-50%, 8px); }
    .wrap.dragging { transition: none; }
    .wrap.min { width: ${MIN_W}px !important; height: ${MIN_H}px !important; bottom: auto !important; }
    iframe { width: 100%; height: 100%; border: 0; display: block; background: #131518; }
    .shield { position: fixed; inset: 0; z-index: 2147483647; cursor: grabbing; }
  `;

  const fitH = () => Math.min(contentH || innerHeight, innerHeight - MARGIN * 2);

  function applyMode() {
    wrap.classList.remove('dock', 'big', 'fit');
    wrap.classList.toggle('min', !!prefs.min);
    wrap.style.left = wrap.style.top = wrap.style.width = wrap.style.height = '';
    if (prefs.mode === 'float' && prefs.rect) {
      const r = clampRect(prefs.min ? { ...prefs.rect, w: MIN_W, h: MIN_H } : { ...prefs.rect, h: fitH() });
      Object.assign(wrap.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    } else if (prefs.mode === 'big') {
      wrap.classList.add('big');
    } else {
      wrap.classList.add('dock');
      if (contentH) {
        wrap.classList.add('fit');
        wrap.style.height = `${fitH()}px`;
      }
    }
  }

  function clampRect({ x, y, w, h }) {
    w = Math.min(w, innerWidth - MARGIN * 2);
    h = Math.min(h, innerHeight - MARGIN * 2);
    return {
      x: Math.max(MARGIN, Math.min(x, innerWidth - w - MARGIN)),
      y: Math.max(MARGIN, Math.min(y, innerHeight - h - MARGIN)),
      w, h,
    };
  }

  function mount() {
    const host = document.createElement('div');
    host.id = 'dsu-spinner-host';
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = css;
    wrap = document.createElement('div');
    wrap.className = 'wrap hidden';
    frame = document.createElement('iframe');
    frame.src = SRC;
    frame.allow = 'autoplay';
    frame.title = 'DSU Spinner';
    frame.addEventListener('load', tellFrame);
    wrap.append(frame);
    shield = document.createElement('div');
    shield.className = 'shield';
    shield.hidden = true;
    root.append(style, wrap, shield);
    document.documentElement.append(host);
    applyMode();
    addEventListener('resize', () => prefs.mode === 'float' && applyMode());
  }

  function show() {
    if (!wrap) mount();
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.remove('hidden')));
    setTimeout(() => frame?.focus(), 250);
  }
  function hide() {
    wrap?.classList.add('hidden');
  }
  const isOpen = () => wrap && !wrap.classList.contains('hidden');
  const toggle = () => (isOpen() ? hide() : show());

  // Let the spinner page know whether it's minimised so it can swap its button and layout.
  function tellFrame() {
    frame?.contentWindow?.postMessage({ source: 'dsu-overlay', min: !!prefs.min, mode: prefs.mode }, ORIGIN);
  }
  function toggleMin() {
    prefs.min = !prefs.min;
    savePrefs();
    applyMode();
    tellFrame();
  }

  function setMode(mode) {
    prefs.mode = mode;
    savePrefs();
    if (wrap) applyMode();
    tellFrame();
  }

  // The iframe captures the pointer and reports how far it has moved since the drag began.
  // The shield stops the page underneath from reacting (text selection, hover) meanwhile.
  let dragFrom = null;
  function startDrag() {
    const box = wrap.getBoundingClientRect();
    // Keep the full panel's width even while dragging the minimised bar.
    const w = prefs.min ? (prefs.rect?.w || DOCK_W) : prefs.mode === 'big' ? DOCK_W : box.width;
    if (prefs.mode === 'big') { prefs.mode = 'float'; tellFrame(); } // dragging the big panel turns it back into the small one
    dragFrom = { x: box.left, y: box.top, w };
    wrap.classList.add('dragging');
    shield.hidden = false;
  }
  function moveDrag(dx, dy) {
    if (!dragFrom) return;
    prefs.mode = 'float';
    const visible = prefs.min ? { w: MIN_W, h: MIN_H } : { w: dragFrom.w, h: fitH() };
    const pos = clampRect({ ...visible, x: dragFrom.x + dx, y: dragFrom.y + dy });
    prefs.rect = { x: pos.x, y: pos.y, w: dragFrom.w };
    applyMode();
  }
  function endDrag() {
    dragFrom = null;
    shield.hidden = true;
    wrap.classList.remove('dragging');
    savePrefs();
  }

  addEventListener('message', (e) => {
    if (e.origin !== ORIGIN || !frame || e.source !== frame.contentWindow) return;
    const msg = e.data;
    if (!msg || msg.source !== 'dsu-spinner') return;
    if (msg.type === 'close') hide();
    else if (msg.type === 'toggle-size') setMode(prefs.mode === 'big' ? 'dock' : 'big');
    else if (msg.type === 'dock') setMode('dock');
    else if (msg.type === 'minimize') toggleMin();
    else if (msg.type === 'hello') tellFrame();
    else if (msg.type === 'height' && +msg.h > 0) {
      contentH = +msg.h;
      if (wrap && prefs.mode !== 'big') applyMode();
    }
    else if (msg.type === 'drag-start') startDrag();
    else if (msg.type === 'drag-move') moveDrag(+msg.dx || 0, +msg.dy || 0);
    else if (msg.type === 'drag-end') endDrag();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'dsu-toggle') toggle();
  });

  window.__dsuSpinner = { toggle };
})();
