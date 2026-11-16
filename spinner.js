import { SQUADS, DEFAULT_TEAM } from './team.js';

// Wheel palettes. Colours go by position on the wheel so neighbours never match.
// ink is the label colour that reads best on that wedge. Change PALETTE to switch.
const INK = '#1d1a16';
const PALETTES = {
  sorbet: [
    { bg: 'oklch(0.80 0.12 160)', ink: INK }, // mint
    { bg: 'oklch(0.78 0.11 235)', ink: INK }, // sky
    { bg: 'oklch(0.88 0.13 95)',  ink: INK }, // lemon
    { bg: 'oklch(0.76 0.13 25)',  ink: INK }, // coral
    { bg: 'oklch(0.76 0.11 300)', ink: INK }, // lilac
    { bg: 'oklch(0.83 0.11 60)',  ink: INK }, // apricot
  ],
  dusk: [
    { bg: 'oklch(0.52 0.08 280)', ink: '#fff' }, // indigo
    { bg: 'oklch(0.60 0.10 330)', ink: '#fff' }, // plum
    { bg: 'oklch(0.68 0.11 20)',  ink: '#fff' }, // coral
    { bg: 'oklch(0.77 0.10 65)',  ink: INK },    // peach
    { bg: 'oklch(0.56 0.09 305)', ink: '#fff' }, // violet
    { bg: 'oklch(0.64 0.11 355)', ink: '#fff' }, // rose
  ],
};
const PALETTE = PALETTES.sorbet;
function wedgeColor(i, n) {
  // With n % 6 === 1 the last wedge would repeat the first one's colour, right next to it.
  if (n > 1 && i === n - 1 && (n - 1) % PALETTE.length === 0) return PALETTE[2];
  return PALETTE[i % PALETTE.length];
}
const STATE_KEY = 'dsuSpinnerState';
const TEAM_KEY = 'dsuSpinnerTeam';
const EMBEDDED = window.top !== window;
// 'dock' for the small docked/floating panel, 'big' for the expanded panel or a full tab.
let layout = EMBEDDED ? 'dock' : 'big';
const teamOpen = () => !!state.teamOpen?.[layout];
let people = [];
let byId = {};
function setPeople(list) {
  people = list.filter((p) => SQUADS.some((s) => s.id === p.squad)).map((p) => ({ ...p }));
  byId = Object.fromEntries(people.map((p) => [p.id, p]));
}

// ---------- storage (chrome.storage as an extension, localStorage otherwise) ----------
const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage?.local;
const store = {
  async get(key) {
    try {
      if (hasChromeStorage) return (await chrome.storage.local.get(key))[key];
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch { return null; }
  },
  async set(key, value) {
    try {
      if (hasChromeStorage) await chrome.storage.local.set({ [key]: value });
      else localStorage.setItem(key, JSON.stringify(value));
    } catch { /* state just won't persist */ }
  },
};

const todayKey = () => new Date().toLocaleDateString('en-CA');
// muted and teamOpen are preferences, so they survive the daily reset.
// The team list starts collapsed in the small docked panel and open in the big one.
const freshState = (prev = {}) => ({
  date: todayKey(), away: [], done: [], current: null,
  muted: !!prev.muted, teamOpen: { dock: false, big: true, ...prev.teamOpen },
});
let state = freshState();

// Forget today's progress for anyone no longer on the team.
function pruneState() {
  const known = (id) => !!byId[id];
  state.away = state.away.filter(known);
  state.done = state.done.filter(known);
  if (state.current && !known(state.current)) state.current = null;
}

async function load() {
  const [saved, team] = await Promise.all([store.get(STATE_KEY), store.get(TEAM_KEY)]);
  setPeople(Array.isArray(team) ? team : DEFAULT_TEAM);
  state = saved && saved.date === todayKey() ? { ...freshState(saved), ...saved } : freshState(saved || {});
  pruneState();
}
const save = () => store.set(STATE_KEY, state);
const saveTeam = () => store.set(TEAM_KEY, people.map(({ id, name, squad }) => ({ id, name, squad })));

if (hasChromeStorage) {
  // Keep spinners open in other tabs in sync.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[TEAM_KEY]) {
      setPeople(changes[TEAM_KEY].newValue || DEFAULT_TEAM);
      if (settingsOpen) renderSettings();
    }
    if (spinning || (!changes[TEAM_KEY] && !changes[STATE_KEY])) return;
    const next = changes[STATE_KEY]?.newValue;
    if (next && JSON.stringify(next) !== JSON.stringify(state)) state = next;
    pruneState();
    if (!state.current) hideResult();
    render();
  });
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const canvas = $('wheel');
const ctx = canvas.getContext('2d');
const spinBtn = $('spinBtn');
const pointer = $('pointer');

const onWheel = () => people.filter((p) => !state.away.includes(p.id) && !state.done.includes(p.id) && p.id !== state.current);
const present = () => people.filter((p) => !state.away.includes(p.id));
const post = (msg) => window.parent.postMessage({ source: 'dsu-spinner', ...msg }, '*');

// ---------- sound ----------
// Chrome only lets audio start from a user gesture, and inside Jira's page the panel
// is a cross-origin frame, so create/resume the context during clicks and keypresses
// rather than lazily mid-animation.
let audio;
function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch { /* audio unavailable */ }
}
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

function tone({ type = 'sine', from, to = from, gain, at = 0, len }) {
  if (state.muted) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime + at;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + len * 0.8);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g).connect(audio.destination);
    osc.start(t);
    osc.stop(t + len + 0.02);
  } catch { /* audio unavailable */ }
}
const tickSound = (s) => tone({ type: 'triangle', from: 1500, to: 500, gain: 0.14 * s, len: 0.05 });
const winSound = () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ from: f, gain: 0.16, at: i * 0.08, len: 0.35 }));

// ---------- wheel ----------
let rotation = -Math.PI / 2;
let spinning = false;
let wheelPeople = [];

function sizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  drawWheel();
}

function drawWheel() {
  const W = canvas.width;
  if (!W) return;
  const R = W / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, W);
  ctx.translate(R, R);

  const list = wheelPeople;
  const n = list.length;
  if (!n) {
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = '#191c20';
    ctx.fill();
    return;
  }
  const seg = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, R, rotation + i * seg, rotation + (i + 1) * seg);
    ctx.closePath();
    ctx.fillStyle = wedgeColor(i, n).bg;
    ctx.fill();
    if (n > 1) {
      ctx.strokeStyle = '#131518';
      ctx.lineWidth = Math.max(1.5, R * 0.008);
      ctx.stroke();
    }
  }

  const fontSize = Math.min(R * 0.095, ((Math.PI * 2 * R * 0.6) / n) * 0.6);
  ctx.font = `600 ${fontSize}px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = wedgeColor(i, n).ink;
    ctx.save();
    ctx.rotate(rotation + (i + 0.5) * seg);
    ctx.fillText(list[i].name, R * 0.9, 0, R * 0.62);
    ctx.restore();
  }
}

const mod = (a, m) => ((a % m) + m) % m;
function indexAtPointer() {
  const n = wheelPeople.length;
  if (!n) return -1;
  return Math.floor(mod(-Math.PI / 2 - rotation, Math.PI * 2) / ((Math.PI * 2) / n)) % n;
}
function randomInt(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

// Shared by every way of turning the wheel: click and flap the pointer when a new
// wedge passes under it.
let tickIdx = -1;
function checkTick(strength) {
  const idx = indexAtPointer();
  if (idx === tickIdx) return;
  tickIdx = idx;
  tickSound(strength);
  pointer.classList.remove('tick');
  void pointer.getBoundingClientRect();
  pointer.classList.add('tick');
}

// Get the wheel ready for a new turn: whoever was up counts as done.
function beginTurn() {
  if (state.current) markDone(state.current, { silent: true });
  wheelPeople = onWheel();
  if (!wheelPeople.length) { render(); return false; }
  spinning = true;
  hideResult();
  render({ keepWheel: true });
  tickIdx = indexAtPointer();
  return true;
}
function endTurn() {
  rotation = mod(rotation, Math.PI * 2);
  spinning = false;
  land(wheelPeople[indexAtPointer()]);
}

// Spin button / Space: random winner, eased stop.
function spin() {
  if (spinning || !beginTurn()) return;
  const n = wheelPeople.length;
  const seg = (Math.PI * 2) / n;
  const winnerIndex = randomInt(n);
  const target = -Math.PI / 2 - (winnerIndex + 0.15 + Math.random() * 0.7) * seg;
  const start = rotation;
  const last = n === 1; // only one person left: a quick turn, then straight to them
  const end = start + (last ? 1 : 5 + randomInt(3)) * Math.PI * 2 + mod(target - start, Math.PI * 2);
  const duration = last ? 900 : 4600 + Math.random() * 1000;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();

  const frame = (now) => {
    const t = reduceMotion ? 1 : Math.min(1, (now - t0) / duration);
    rotation = start + (end - start) * (1 - Math.pow(1 - t, 4));
    drawWheel();
    checkTick(0.6 + 0.4 * (1 - t));
    if (t < 1) return requestAnimationFrame(frame);
    endTurn();
  };
  requestAnimationFrame(frame);
}

// Flung by hand: keep the release speed and let friction slow it down.
function coast(omega) {
  omega = Math.max(-30, Math.min(30, omega));
  const t0 = performance.now();
  const maxMs = wheelPeople.length === 1 ? 900 : Infinity; // last person: don't keep them waiting
  let last = t0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const speed = Math.max(0, Math.abs(omega) - (1.4 + 0.3 * Math.abs(omega)) * dt);
    omega = Math.sign(omega) * speed;
    rotation += omega * dt;
    drawWheel();
    checkTick(Math.min(1, 0.5 + speed / 20));
    if (speed > 0.06 && now - t0 < maxMs) return requestAnimationFrame(frame);
    endTurn();
  };
  requestAnimationFrame(frame);
}

// Grab the wheel with the mouse: drag to turn it, flick to spin it, or drag slowly
// and let go to pick whoever is under the pointer. A plain click does nothing.
let grab = null;
function polar(e) {
  const r = canvas.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  return { a: Math.atan2(dy, dx), d: Math.hypot(dx, dy) / (r.width / 2) };
}
canvas.addEventListener('pointerdown', (e) => {
  if (spinning || e.button !== 0 || polar(e).d > 1) return;
  if (!onWheel().length && !state.current) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const now = performance.now();
  grab = { a: polar(e).a, moved: 0, started: false, samples: [{ t: now, rot: rotation }] };
});
canvas.addEventListener('pointermove', (e) => {
  if (!grab) return;
  const a = polar(e).a;
  let d = a - grab.a;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  grab.a = a;
  grab.moved += Math.abs(d);
  if (!grab.started) {
    if (grab.moved < 0.03) return; // ignore jitter from a plain click
    if (!beginTurn()) { grab = null; return; }
    grab.started = true;
    canvas.classList.add('grabbing');
  }
  rotation += d;
  const now = performance.now();
  grab.samples.push({ t: now, rot: rotation });
  while (grab.samples.length > 2 && now - grab.samples[0].t > 90) grab.samples.shift();
  drawWheel();
  checkTick(0.7);
});
function release() {
  if (!grab) return;
  const g = grab;
  grab = null;
  canvas.classList.remove('grabbing');
  if (!g.started) return;
  const now = performance.now();
  const first = g.samples[0];
  const dt = (now - first.t) / 1000;
  const omega = dt > 0.01 ? (rotation - first.rot) / dt : 0;
  if (Math.abs(omega) > 1.5) coast(omega);
  else endTurn(); // placed by hand
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

function land(person) {
  state.current = person.id;
  save();
  winSound();
  showResult(person);
  render({ keepWheel: true });
}

// ---------- result ----------
function showResult(person) {
  const el = $('result');
  const i = wheelPeople.indexOf(person);
  el.style.setProperty('--winner', wedgeColor(i, wheelPeople.length).bg);
  $('resultName').textContent = person.name;
  el.hidden = false;
}
function hideResult() { $('result').hidden = true; }
const resultOpen = () => !$('result').hidden;
// "Start": close the popup and leave them up as the current speaker.
function startCurrent() {
  hideResult();
  render({ keepWheel: true });
}

function markDone(id, { silent = false } = {}) {
  if (!id) return;
  if (!state.done.includes(id)) state.done.push(id);
  if (state.current === id) state.current = null;
  save();
  if (!silent) { hideResult(); render(); }
}
function setAway(id, away) {
  state.away = state.away.filter((x) => x !== id);
  if (away) {
    state.away.push(id);
    if (state.current === id) { state.current = null; hideResult(); }
  }
  save();
  render();
}
// "Skip": take them off the wheel and go again straight away.
function skipCurrent() {
  if (!state.current) return;
  setAway(state.current, true);
  if (onWheel().length) spin();
}

// ---------- render ----------
function render({ keepWheel = false } = {}) {
  if (!spinning && !keepWheel) wheelPeople = onWheel();

  const total = present().length;
  const done = state.done.filter((id) => !state.away.includes(id)).length;
  $('count').textContent = `${done}/${total}`;

  const remaining = onWheel().length;
  spinBtn.disabled = spinning || remaining === 0;

  const cur = state.current && byId[state.current];
  const now = $('now');
  now.hidden = !cur || resultOpen() || spinning;
  if (cur) {
    // Once their wedge is off the wheel, keep the colour they landed on.
    const i = wheelPeople.indexOf(cur);
    if (i >= 0) now.style.setProperty('--c', wedgeColor(i, wheelPeople.length).bg);
    else if (now.dataset.id !== cur.id) now.style.setProperty('--c', 'var(--muted)');
    now.dataset.id = cur.id;
    $('nowName').textContent = cur.name;
  }

  // Nobody left to pick: empty wheel with the sign hanging off the pointer.
  const allDone = !spinning && remaining === 0 && total > 0 && !resultOpen();
  if (allDone) wheelPeople = [];
  $('sign').toggleAttribute('hidden', !allDone); // SVG has no .hidden property

  $('app').classList.toggle('team-collapsed', !teamOpen());
  $('teamBtn').setAttribute('aria-expanded', String(teamOpen()));
  $('teamBtn').title = teamOpen() ? 'Hide team (T)' : 'Show team (T)';
  $('soundToggle').setAttribute('aria-checked', String(!state.muted));

  renderRoster();
  drawWheel();
}

function renderRoster() {
  const root = $('roster');
  root.textContent = '';
  for (const squad of SQUADS) {
    const members = people.filter((p) => p.squad === squad.id);
    if (!members.length) continue;
    const col = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'squad-head' + (members.every((p) => state.away.includes(p.id)) ? ' away' : '');
    const title = document.createElement('span');
    title.className = 'squad-name';
    title.textContent = squad.name;
    head.append(title, squadToggle(squad.name, members));
    col.append(head);
    for (const p of members) col.append(personRow(p));
    root.append(col);
  }
}

// Whole-squad switch: on while anyone in the squad is here. Off marks them all away
// for today; on again brings everyone back.
function squadToggle(name, members) {
  const anyHere = members.some((p) => !state.away.includes(p.id));
  const toggle = document.createElement('button');
  toggle.className = 'toggle';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(anyHere));
  toggle.title = anyHere ? `${name} not here today` : `${name} is here`;
  toggle.onclick = () => {
    const ids = members.map((p) => p.id);
    state.away = state.away.filter((id) => !ids.includes(id));
    if (anyHere) {
      state.away.push(...ids);
      if (ids.includes(state.current)) { state.current = null; hideResult(); }
    }
    save();
    render();
  };
  return toggle;
}

function personRow(p) {
  const away = state.away.includes(p.id);
  const doneIdx = state.done.indexOf(p.id);
  const row = document.createElement('div');
  row.className = 'person' + (away ? ' away' : '') + (doneIdx >= 0 ? ' done' : '') + (state.current === p.id ? ' current' : '');

  const name = nameLabel(p);
  if (doneIdx >= 0) {
    const no = document.createElement('span');
    no.className = 'order-no';
    no.textContent = doneIdx + 1;
    no.title = 'Put back on the wheel';
    no.onclick = () => { state.done.splice(state.done.indexOf(p.id), 1); save(); render(); };
    name.append(no);
  }

  const toggle = document.createElement('button');
  toggle.className = 'toggle';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(!away));
  toggle.title = away ? 'Away' : 'Here';
  toggle.onclick = () => setAway(p.id, !away);

  row.append(name, toggle);
  return row;
}

function nameLabel(p) {
  const label = document.createElement('span');
  label.className = 'pname';
  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = p.name;
  label.append(who);
  return label;
}

// ---------- settings ----------
let settingsOpen = false;
function toggleSettings(open = !settingsOpen) {
  if (open && spinning) return;
  settingsOpen = open;
  $('app').classList.toggle('settings-open', open);
  $('settingsBtn').setAttribute('aria-pressed', String(open));
  $('settingsBtn').title = open ? 'Back to the wheel' : 'Settings';
  if (open) renderSettings();
}

const slug = (name) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function addPerson(name, squad) {
  const base = slug(name) || 'person';
  let id = base;
  for (let n = 2; byId[id]; n++) id = `${base}-${n}`;
  setPeople([...people, { id, name, squad }]);
  saveTeam();
  render();
}
function removePerson(id) {
  setPeople(people.filter((p) => p.id !== id));
  pruneState();
  if (!state.current) hideResult();
  save();
  saveTeam();
  render();
  renderSettings();
}

function renderSettings(focusSquad) {
  const root = $('settingsSquads');
  root.textContent = '';
  for (const squad of SQUADS) {
    const col = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'squad-head';
    const title = document.createElement('span');
    title.className = 'squad-name';
    title.textContent = squad.name;
    head.append(title);
    col.append(head);
    for (const p of people.filter((x) => x.squad === squad.id)) {
      const row = document.createElement('div');
      row.className = 'person';
      const remove = document.createElement('button');
      remove.className = 'remove-btn';
      remove.title = `Remove ${p.name}`;
      remove.setAttribute('aria-label', remove.title);
      remove.innerHTML = ICON_REMOVE;
      remove.onclick = () => removePerson(p.id);
      row.append(nameLabel(p), remove);
      col.append(row);
    }
    col.append(addForm(squad));
    root.append(col);
  }
  if (focusSquad) root.querySelector(`[data-squad="${focusSquad}"] input`)?.focus();
}

function addForm(squad) {
  const form = document.createElement('form');
  form.className = 'add-person';
  form.dataset.squad = squad.id;
  const input = document.createElement('input');
  input.placeholder = `Add to ${squad.name}`;
  input.setAttribute('aria-label', input.placeholder);
  input.maxLength = 24;
  input.autocomplete = 'off';
  input.oninput = () => input.setCustomValidity('');
  const add = document.createElement('button');
  add.className = 'text-btn strong';
  add.textContent = 'Add';
  form.append(input, add);
  form.onsubmit = (e) => {
    e.preventDefault();
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      input.setCustomValidity(`${name} is already on the team`);
      input.reportValidity();
      return;
    }
    addPerson(name, squad.id);
    renderSettings(squad.id);
  };
  return form;
}

const ICON_REMOVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';
const ICON_MINIMISE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 12h12"/></svg>';
const ICON_RESTORE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2.5"/></svg>';
// ---------- wiring ----------
const toggleTeam = () => {
  state.teamOpen = { dock: false, big: true, ...state.teamOpen, [layout]: !teamOpen() };
  save();
  render({ keepWheel: true });
};
const toggleMute = () => { state.muted = !state.muted; save(); render({ keepWheel: true }); };
const reset = () => { state = freshState(state); save(); hideResult(); render(); };

spinBtn.addEventListener('click', spin);
$('resultStart').addEventListener('click', startCurrent);
$('resultSkip').addEventListener('click', skipCurrent);
$('nowDone').addEventListener('click', () => markDone(state.current));
$('teamBtn').addEventListener('click', toggleTeam);
$('settingsBtn').addEventListener('click', () => toggleSettings());
$('settingsDone').addEventListener('click', () => toggleSettings(false));
$('soundToggle').addEventListener('click', toggleMute);
$('resetBtn').addEventListener('click', reset);

if (EMBEDDED) {
  document.body.classList.add('embedded');
  $('closeBtn').addEventListener('click', () => post({ type: 'close' }));
  $('sizeBtn').addEventListener('click', () => post({ type: 'toggle-size' }));
  $('minBtn').addEventListener('click', () => post({ type: 'minimize' }));
  // The overlay tells us when we're minimised to just the header bar.
  addEventListener('message', (e) => {
    if (e.source !== window.parent || e.data?.source !== 'dsu-overlay') return;
    const min = !!e.data.min;
    const nextLayout = e.data.mode === 'big' ? 'big' : 'dock';
    if (nextLayout !== layout) { layout = nextLayout; render({ keepWheel: true }); }
    document.body.classList.toggle('minimized', min);
    $('minBtn').title = min ? 'Restore' : 'Minimise';
    $('minBtn').setAttribute('aria-label', min ? 'Restore' : 'Minimise');
    $('minBtn').innerHTML = min ? ICON_RESTORE : ICON_MINIMISE;
  });
  post({ type: 'hello' });
  // The docked/floating panel sizes itself to this page's content.
  new ResizeObserver(() => post({ type: 'height', h: Math.ceil($('app').getBoundingClientRect().height) })).observe($('app'));

  // Drag the floating panel by its header. Pointer capture keeps the moves coming here
  // even when the cursor leaves the iframe; screen coordinates stay stable while the
  // iframe itself moves underneath the cursor.
  const header = document.querySelector('.top');
  let drag = null;
  header.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, a')) return;
    e.preventDefault();
    header.setPointerCapture(e.pointerId);
    drag = { x: e.screenX, y: e.screenY };
    post({ type: 'drag-start' });
  });
  header.addEventListener('pointermove', (e) => {
    if (drag) post({ type: 'drag-move', dx: e.screenX - drag.x, dy: e.screenY - drag.y });
  });
  const endDrag = () => { if (drag) { drag = null; post({ type: 'drag-end' }); } };
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);
  header.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button, a')) post({ type: 'dock' });
  });
}

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (settingsOpen) {
    if (e.key === 'Escape') { e.preventDefault(); toggleSettings(false); }
    else if (e.key.toLowerCase() === 'm' && !e.target.closest('input')) toggleMute();
    return;
  }
  const cur = state.current && byId[state.current];
  const k = e.key.toLowerCase();
  if (e.code === 'Space') { e.preventDefault(); spin(); }
  else if (e.key === 'Enter' && resultOpen()) { e.preventDefault(); startCurrent(); }
  else if (e.key === 'Enter' && cur) { e.preventDefault(); markDone(cur.id); }
  else if (e.key === 'Escape' && resultOpen()) startCurrent();
  else if (e.key === 'Escape' && EMBEDDED) post({ type: 'close' });
  else if (k === 's' && cur) skipCurrent();
  else if (k === 'm') toggleMute();
  else if (k === 't') toggleTeam();
});

await load();
render();
new ResizeObserver(sizeCanvas).observe(canvas);
