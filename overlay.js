// Floating spinner panel injected into the current page.
// - Runs automatically on impact.atlassian.net so the panel survives the reload when a
//   board is opened. Open/closed state and position live in this tab's sessionStorage.
// - Injected on demand on any other page when the toolbar icon is clicked.
// Modes: "dock" (right edge, full height), "big" (centred, for screensharing),
//        "float" (wherever it was dragged to).
(() => {
  if (window.__dsuSpinner) return;
  if (window.top !== window) return;

  const ORIGIN = new URL(chrome.runtime.getURL('')).origin;
  const SRC = chrome.runtime.getURL('spinner.html');
  const KEY = 'dsuSpinnerOverlay';
  const JIRA = 'https://impact.atlassian.net/';
  const MARGIN = 12;
  const MIN_W = 300; // minimised: just the header bar
  const MIN_H = 56;
  const DOCK_W = 380;
  let contentH = 0; // height the spinner page reports; the small panel fits it

  const readPrefs = () => {
    try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  let prefs = { open: false, mode: 'dock', rect: null, min: false, ...readPrefs() };
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
    prefs.open = true;
    savePrefs();
    setTimeout(() => frame?.focus(), 250);
  }
  function hide() {
    if (!wrap) return;
    wrap.classList.add('hidden');
    prefs.open = false;
    savePrefs();
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

  // ---------- Filtering the board to one person ----------
  // Jira boards ignore ?assignee= in the URL, so do what a person would: click their
  // avatar in the board's assignee filter (clearing anyone else selected there).
  // Same board: no reload at all. Other board: load it once, then click when it renders.
  const PENDING_KEY = 'dsuSpinnerPendingFilter';
  const CONTROL = 'input[type="checkbox"], [role="checkbox"], [role="menuitemcheckbox"], [role="option"], button, [role="button"]';
  const CHECKBOXY = 'input[type="checkbox"], [role="checkbox"], [role="menuitemcheckbox"], [role="option"]';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (t) => (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

  function describe(el) {
    const parts = [el.getAttribute('aria-label'), el.getAttribute('title'), el.textContent];
    const ids = el.getAttribute('aria-labelledby');
    if (ids) for (const id of ids.split(/\s+/)) parts.push(document.getElementById(id)?.textContent);
    const scope = avatarScope(el);
    for (const img of scope.querySelectorAll('img, [role="img"]')) {
      parts.push(img.getAttribute('alt'), img.getAttribute('aria-label'), img.getAttribute('src'));
    }
    if (scope !== el) parts.push(scope.textContent);
    return parts.filter(Boolean).join(' | ');
  }
  function isPerson(el, person) {
    const d = describe(el);
    if (norm(d).includes(norm(person.name))) return true;
    const id = person.accountId;
    return id.length >= 10 && (d.includes(id) || d.includes(encodeURIComponent(id)));
  }
  const inFilterBar = (el) => !!el.closest('[data-testid*="filter" i], [aria-label*="filter" i], [data-testid*="assignee" i]');
  const inCard = (el) => !!el.closest('[data-testid*="card" i], [data-testid*="issue" i][role="button"], [role="dialog"]');
  const isChecked = (el) => el.checked === true || ['aria-checked', 'aria-pressed', 'aria-selected']
    .some((a) => el.getAttribute(a) === 'true');

  function findAvatar(person) {
    const hits = [...document.querySelectorAll(CONTROL)]
      .filter((el) => !inCard(el) && isPerson(el, person))
      .filter((el) => inFilterBar(el) || el.matches(CHECKBOXY));
    return hits.find((el) => el.matches(CHECKBOXY)) || hits[0] || null;
  }
  // The "+3" button that holds the assignees who don't fit in the avatar row.
  function findOverflow() {
    return [...document.querySelectorAll('button, [role="button"]')].find((el) =>
      inFilterBar(el) && !inCard(el) && (/^\+\s*\d+$/.test(el.textContent.trim()) ||
        /more|overflow/i.test(el.getAttribute('data-testid') || '')));
  }
  const LAST_KEY = 'dsuSpinnerLastFilter';
  const log = (...args) => console.debug('[DSU]', ...args);
  const snippet = (el) => el?.outerHTML?.slice(0, 300);

  // Selected state of an avatar control: true/false, or null if Jira doesn't expose it
  // anywhere we can read (then we fall back to remembering who we selected).
  function stateOf(el) {
    if (el.matches('input[type="checkbox"]')) return el.checked;
    for (const a of ['aria-checked', 'aria-pressed', 'aria-selected']) {
      const v = el.getAttribute(a);
      if (v === 'true' || v === 'false') return v === 'true';
    }
    for (const node of [el, avatarScope(el)]) {
      const ds = node.getAttribute('data-state');
      if (ds === 'checked' || ds === 'on') return true;
      for (const a of ['data-checked', 'data-selected', 'data-is-selected']) {
        const v = node.getAttribute(a);
        if (v === 'true' || v === 'false') return v === 'true';
      }
      if (/(^|[\s_-])(is-?)?(selected|checked)($|[\s_-])/i.test(node.className?.baseVal ?? node.className ?? '')) return true;
    }
    const input = (el.closest('label') || el).querySelector('input[type="checkbox"]') ||
      el.parentElement?.querySelector(':scope > input[type="checkbox"]');
    return input ? input.checked : null;
  }
  // The avatar that goes with a control: inside it, its <label>, or (for a hidden
  // checkbox) its wrapper. Quick filters like "Only my issues" have none.
  const avatarScope = (el) => el.closest('label') || (el.matches('input') ? el.parentElement : el);
  const hasAvatar = (el) => !!avatarScope(el)?.querySelector('img, [role="img"], [data-testid*="avatar" i]');

  // Everyone else selected in the assignee filter (not quick filters: those have no avatar).
  function selectedOthers(person) {
    const sel = 'input[type="checkbox"]:checked, [aria-checked="true"], [aria-pressed="true"], [aria-selected="true"]';
    return [...document.querySelectorAll(sel)].filter((el) =>
      inFilterBar(el) && !inCard(el) && hasAvatar(el) && !isPerson(el, person));
  }

  const readLast = () => {
    try {
      const last = JSON.parse(sessionStorage.getItem(LAST_KEY));
      return last?.path === location.pathname ? last.person : null;
    } catch { return null; }
  };
  const writeLast = (person) => {
    try { sessionStorage.setItem(LAST_KEY, JSON.stringify({ path: location.pathname, person })); } catch { /* ignore */ }
  };

  // Find a person's avatar, looking in the "+N" overflow menu too. Returns a closer for the menu.
  async function locate(person, timeout = 0) {
    const until = Date.now() + timeout;
    let el = findAvatar(person);
    while (!el && Date.now() < until) { await sleep(250); el = findAvatar(person); }
    if (el) return { el, close: () => {} };
    const more = findOverflow();
    if (!more) return { el: null, close: () => {} };
    more.click();
    await sleep(400);
    const close = () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    el = findAvatar(person);
    if (!el) close();
    return { el, close };
  }

  async function filterTo(person, timeout = 0) {
    let { el: target, close } = await locate(person, timeout);
    if (!target) { log('no avatar for', person.name); return false; }
    const known = stateOf(target) !== null;
    log('target', person.name, 'state', stateOf(target), snippet(target));

    // 1. Clear whoever else is selected.
    const others = selectedOthers(person);
    log('selected others', others.map(snippet));
    for (const other of others) { other.click(); await sleep(80); }
    if (!others.length && !known) {
      const last = readLast();
      if (last && last.accountId !== person.accountId) {
        close();
        const prev = await locate(last);
        log('unselecting remembered', last.name, snippet(prev.el));
        if (prev.el) { prev.el.click(); await sleep(120); }
        prev.close();
        ({ el: target, close } = await locate(person));
        if (!target) return false;
      }
    }

    // 2. Select them (React may have re-rendered the row, so look it up again).
    target = findAvatar(person) || target;
    const state = stateOf(target);
    const alreadyOn = state === null ? readLast()?.accountId === person.accountId : state;
    if (!alreadyOn) target.click();
    writeLast(person);
    await sleep(150);
    close();
    return true;
  }

  function tellToast(text) {
    frame?.contentWindow?.postMessage({ source: 'dsu-overlay', toast: text }, ORIGIN);
  }
  const firstName = (person) => person.name.split(' ')[0];

  async function openFor(target, fallbackUrl) {
    const board = new URL(target.board);
    if (location.origin !== board.origin) { open(fallbackUrl, '_blank', 'noopener'); return; }
    if (!target.person) { if (location.pathname !== board.pathname) location.assign(board.href); return; }
    if (location.pathname === board.pathname) {
      const ok = await filterTo(target.person, 1500);
      if (!ok) tellToast(`${firstName(target.person)} has nothing on this board`);
      return;
    }
    try {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ path: board.pathname, person: target.person, at: Date.now() }));
    } catch { /* filter just won't be applied */ }
    location.assign(board.href);
  }

  // Finish a filter started on the previous page, once the board has rendered.
  async function resumePending() {
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem(PENDING_KEY)); sessionStorage.removeItem(PENDING_KEY); } catch { return; }
    if (!pending || pending.path !== location.pathname || Date.now() - pending.at > 30000) return;
    const ok = await filterTo(pending.person, 12000);
    if (!ok) tellToast(`${firstName(pending.person)} has nothing on this board`);
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
    else if (msg.type === 'navigate' && typeof msg.url === 'string' && msg.url.startsWith(JIRA)) {
      if (prefs.mode === 'big') setMode('dock'); // so the board shows beside the wheel
      prefs.open = true;
      savePrefs();
      const t = msg.target;
      const valid = t && typeof t.board === 'string' && t.board.startsWith(JIRA) &&
        (!t.person || (typeof t.person.name === 'string' && typeof t.person.accountId === 'string'));
      if (valid) openFor(t, msg.url);
      else if (location.href.startsWith(JIRA)) location.assign(msg.url);
      else open(msg.url, '_blank', 'noopener');
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'dsu-toggle') toggle();
  });

  window.__dsuSpinner = { toggle };
  if (prefs.open) show();
  if (location.href.startsWith(JIRA)) resumePending();
})();
