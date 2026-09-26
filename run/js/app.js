import {
  PLAN, TOTAL, WEEK_COUNT, RUNS_PER_WEEK, FEELINGS, mmss, totals, describe, locate, intervalNumbers, newState,
  nextWorkout, applyFeedback, painMentioned, setPosition, withWarmup,
} from './c25k.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmtDate = (iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(iso).toLocaleDateString(undefined, opts);
const mins = (sec) => Math.round(sec / 60);
const NAME = { warmup: 'Warm up', run: 'Run', walk: 'Walk', cooldown: 'Cool down' };
const DEFAULTS = { voice: true, sound: true, vibrate: true, keepAwake: true };

// ---------- Storage ----------
const store = {
  load(k, d) {
    try {
      const v = localStorage.getItem('c25k.' + k);
      return v ? JSON.parse(v) : d;
    } catch { return d; }
  },
  save(k, v) {
    try { localStorage.setItem('c25k.' + k, JSON.stringify(v)); } catch { toast('Could not save — storage may be full.'); }
  },
};
const S = {
  settings: { ...DEFAULTS, ...store.load('settings', {}) },
  state: { ...newState(), ...store.load('state', {}) },
  active: store.load('active', null),
  pending: store.load('pending', null),
  undo: store.load('undo', null),
};
const save = (...keys) => keys.forEach((k) => store.save(k, S[k]));

// ---------- Navigation ----------
let view = S.active ? 'run' : S.pending ? 'feedback' : 'today';
let param = null;

function go(v, p = null, push = true) {
  view = v; param = p;
  if (push) history.pushState({ v, p }, '');
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', (e) => {
  const st = e.state || { v: 'today' };
  // The live run and unanswered feedback can't be navigated away from with the back button.
  if (S.active) return go('run', null, false);
  if (S.pending) return go('feedback', null, false);
  go(st.v, st.p, false);
});
history.replaceState({ v: view, p: null }, '');

const TAB_OF = { today: 'today', run: 'today', feedback: 'today', plan: 'plan', planRun: 'plan', history: 'history', more: 'more' };

function render() {
  const out = (VIEWS[view] || VIEWS.today)(param);
  document.body.classList.toggle('running', view === 'run');
  $('#title').textContent = out.title;
  $('#topAction').innerHTML = out.action || '';
  $('#main').innerHTML = out.body;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === TAB_OF[view]));
  if (view === 'run') { cueIdx = null; tick(); }
}

let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- Shared bits ----------
function timeline(segs, id = '') {
  return `<div class="tl" ${id ? `id="${id}"` : ''}>${segs.map((s) => `<i class="${s.type}" style="flex:${s.sec}"></i>`).join('')}${id ? '<b class="mark"></b>' : ''}</div>`;
}
const legend = (segs) => `<div class="legend">${['warmup', 'run', 'walk'].filter((t) => segs.some((s) => s.type === t))
  .map((t) => `<span class="${t}">${t === 'warmup' ? 'Warm up / cool down' : NAME[t]}</span>`).join('')}</div>`;

function intervalList(segs, id = '') {
  const nums = intervalNumbers(segs);
  return `<ol class="intervals" ${id ? `id="${id}"` : ''}>${segs.map((s, i) => `<li class="${s.type}">${NAME[s.type]}${nums[i] && nums[i].of > 1 ? ` ${nums[i].n}/${nums[i].of}` : ''}<span class="t">${mmss(s.sec)}</span></li>`).join('')}</ol>`;
}

function stats(segs) {
  const t = totals(segs.filter((s) => s.type === 'run' || s.type === 'walk'));
  return `<div class="big-stat"><div><b>${mins(totals(segs).total)} min</b>total</div><div><b>${mmss(t.run)}</b>running</div><div><b>${mmss(t.walk)}</b>walking</div></div>`;
}

const feelBadge = (f) => (FEELINGS[f] ? `${FEELINGS[f].emoji} ${FEELINGS[f].label}` : '');
const loggedPositions = () => new Set(S.state.log.map((e) => e.pos));

// ---------- Views ----------
const VIEWS = {};

VIEWS.today = () => {
  const w = nextWorkout(S.state);
  const last = S.state.log.at(-1);
  let body = '';

  if (w.graduated) {
    body += `<div class="card hl"><h3>🏅 You did it: Couch to 5K complete</h3>
      <p class="muted">You can run 30 minutes non-stop. Keep it up with three runs a week.</p>
      <div class="stack" style="margin-top:10px"><button class="go block" data-a="startBonus">Run 30 minutes again</button>
      <button class="block" data-a="restart">Start the program over</button></div></div>`;
  } else {
    const next = w.restLeft > 0 ? new Date(Date.now() + w.restLeft * 86400000) : null;
    body += `<div class="card hl">
      <div class="row between"><h3>Week ${w.week} · Run ${w.day}</h3>${w.eased ? '<span class="pill star">Gentler</span>' : ''}</div>
      <p class="muted small">5 min warm-up walk → ${esc(describe(w.main))} → 5 min cool-down walk</p>
      ${stats(w.segments)}
      ${timeline(w.segments)}${legend(w.segments)}
      ${w.notes.map((n) => `<div class="note">${esc(n)}</div>`).join('')}
      ${next ? `<div class="note info">Rest day. Your legs get stronger on rest days. Next run from <b>${fmtDate(next)}</b>.</div>` : ''}
      <button class="go block" style="margin-top:10px" data-a="start">${next ? 'Run anyway' : 'Start run'}</button>
      <details style="margin-top:8px"><summary class="muted small">Show all ${w.segments.length} intervals ▾</summary>${intervalList(w.segments)}</details>
    </div>`;
  }

  if (last) {
    body += `<h2>Last run</h2><div class="card">
      <div class="row between"><b>Week ${last.week} · Run ${last.day}</b><span class="muted small">${fmtDate(last.date)}</span></div>
      <p>${feelBadge(last.feeling)}${last.pain ? ' · 🩹 something hurt' : ''}</p>
      ${last.notes ? `<p class="muted small">“${esc(last.notes)}”</p>` : ''}
      <div class="note ${last.change.kind === 'advance' || last.change.kind === 'jump' || last.change.kind === 'finish' ? 'good' : ''}"><b>${esc(last.change.headline)}</b><br>${esc(last.change.detail)}</div>
      ${S.undo ? '<button class="sm ghost" data-a="undo">↶ Undo this entry</button>' : ''}</div>`;
  }

  const done = Math.min(S.state.pos, TOTAL);
  body += `<h2>Progress</h2><div class="card"><div class="row between"><b>${w.graduated ? 'All 9 weeks done' : `Week ${w.week} of ${WEEK_COUNT}`}</b><span class="muted small">${S.state.log.length} run${S.state.log.length === 1 ? '' : 's'} logged</span></div>
    <div class="tl">${PLAN.map((p, i) => `<i class="${i < done ? 'run' : 'walk past'}" style="flex:1"></i>`).join('')}</div></div>`;

  if (!S.state.log.length) {
    body += `<h2>How it works</h2><div class="card small"><ol class="steps">
      <li>Run <b>3 times a week</b> with a rest day in between. Each run is about 30 minutes.</li>
      <li>Every run starts with a <b>5-minute brisk walk</b> and ends with a 5-minute cool-down walk.</li>
      <li>The app tells you when to <b>run</b> and when to <b>walk</b>, with voice, beeps and vibration. Run slowly enough that you could talk.</li>
      <li>After each run, tell the app how it felt. It changes your next run:
        <ul><li>😄 Easy twice in a row → skip ahead a week</li><li>😮‍💨 Hard → longer walk breaks next time</li>
        <li>😣 Couldn't finish → repeat it, gentler</li><li>🩹 Something hurts → extra rest, then a gentler repeat</li></ul></li>
      </ol><p class="muted">Already running a bit? Pick your starting week in <b>Plan</b>.</p></div>`;
  }
  return { title: 'Next run', body };
};

VIEWS.run = () => {
  const a = S.active;
  if (!a) return VIEWS.today();
  const body = `<div class="live">
    <div class="head"><span>Week ${a.week} · Run ${a.day}${a.eased ? ' · gentler' : ''}</span><span id="clockNow"></span></div>
    <div class="phase ${a.segments[0].type}" id="phase">
      <div class="kind" id="kind"></div>
      <div class="count" id="count"></div>
      <div class="ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" id="arc" cx="60" cy="60" r="54" stroke-dasharray="339.29" stroke-dashoffset="0"/></svg>
        <div class="clock"><b id="clock">0:00</b><span id="of"></span></div></div>
      <div class="next" id="next"></div>
    </div>
    ${timeline(a.segments, 'tl')}
    <div class="times"><span>Elapsed <b id="el"></b></span><span>Running left <b id="runLeft"></b></span><span>Total left <b id="left"></b></span></div>
    <div class="controls">
      <button data-a="back" aria-label="Back to start of interval">⏮ Back</button>
      <button class="pp primary" data-a="pause" id="pp">⏸ Pause</button>
      <button data-a="skip" aria-label="Skip to next interval">Skip ⏭</button>
    </div>
    <button class="block danger" style="margin-top:10px" data-a="end">End run</button>
    <details><summary>All intervals ▾</summary>${intervalList(a.segments, 'ivs')}</details>
    <p class="muted small">Keep this screen open. Phones pause web apps when the screen locks, so cues can be late. Put the phone in a pocket or armband with the screen on.</p>
  </div>`;
  return { title: 'Running', body };
};

VIEWS.feedback = () => {
  const p = S.pending;
  if (!p) return VIEWS.today();
  const body = `<div class="card hl"><h3>Week ${p.week} · Run ${p.day} ${p.completed ? 'done 🎉' : 'ended early'}</h3>
      <div class="big-stat"><div><b>${mmss(p.durationSec)}</b>time</div><div><b>${mmss(p.runSec)}</b>running</div><div><b>${p.completed ? '✓' : `${Math.round((p.runSec / p.plannedRunSec) * 100)}%`}</b>of run intervals</div></div></div>
    <h2>How did it feel?</h2>
    <div class="feel">${Object.entries(FEELINGS).map(([k, f]) => `<button data-a="feel" data-v="${k}" class="${p.feeling === k ? 'on' : ''}"><span class="e">${f.emoji}</span><b>${f.label}</b><span class="h">${f.hint}</span></button>`).join('')}</div>
    <label class="chk"><input type="checkbox" data-f="pain" ${p.pain ? 'checked' : ''}> 🩹 Something hurts (knee, shin, ankle, hip, foot…)</label>
    <label>Tell me more (optional)</label>
    <textarea data-f="notes" placeholder="How did your breathing and legs feel? Anything hurt? Was one interval the hardest?">${esc(p.notes || '')}</textarea>
    <div class="note ${painMentioned(p.notes) && !p.pain ? '' : 'hidden'}" id="painHint">It sounds like something hurts. Tick <b>Something hurts</b> above and the plan will give you extra rest.</div>
    <button class="primary block" style="margin-top:14px" data-a="saveFeedback" ${p.feeling ? '' : 'disabled'}>Save and plan my next run</button>
    <button class="ghost block danger" data-a="discard">Discard this run</button>`;
  return { title: 'How was it?', body };
};

VIEWS.plan = () => {
  const cur = nextWorkout(S.state).pos;
  const logged = loggedPositions();
  let body = '<p class="muted small">Nine weeks, three runs a week. Each run has a 5-minute warm-up walk and cool-down walk. Tap a run to see its intervals or to start there.</p>';
  for (let w = 0; w < WEEK_COUNT; w++) {
    body += `<div class="card wk"><h3>Week ${w + 1}</h3><div class="runs">`;
    for (let d = 0; d < RUNS_PER_WEEK; d++) {
      const pos = w * RUNS_PER_WEEK + d, p = PLAN[pos];
      const cls = pos === cur ? 'cur' : logged.has(pos) ? 'done' : '';
      body += `<button class="runrow ${cls}" data-a="viewRun" data-pos="${pos}"><span class="st">${cls === 'done' ? '✓' : cls === 'cur' ? '▶' : p.day}</span>
        <span class="grow">Run ${p.day}<small>${esc(describe(p.main))}</small></span><span class="muted small">${mins(totals(withWarmup(p.main)).total)} min</span></button>`;
    }
    body += '</div></div>';
  }
  return { title: 'Plan', body };
};

VIEWS.planRun = (pos) => {
  const p = PLAN[pos];
  const segs = withWarmup(p.main);
  const isNext = nextWorkout(S.state).pos === pos;
  const body = `<div class="card"><h3>Week ${p.week} · Run ${p.day}</h3><p class="muted small">${esc(describe(p.main))}</p>
    ${stats(segs)}${timeline(segs)}${legend(segs)}${intervalList(segs)}
    ${isNext ? '<div class="note good">This is your next run.</div>' : `<button class="primary block" style="margin-top:10px" data-a="setPos" data-pos="${pos}">Make this my next run</button>`}</div>`;
  return { title: `Week ${p.week} · Run ${p.day}`, action: '<button class="sm" data-a="toPlan">← Plan</button>', body };
};

VIEWS.history = () => {
  const log = [...S.state.log].reverse();
  if (!log.length) return { title: 'History', body: '<div class="card muted">No runs yet. Your runs and how they felt will show up here.</div>' };
  const runSec = S.state.log.reduce((a, e) => a + (e.runSec || 0), 0);
  let body = `<div class="big-stat"><div><b>${log.length}</b>runs</div><div><b>${mins(runSec)} min</b>spent running</div><div><b>${mins(S.state.log.reduce((a, e) => a + e.durationSec, 0))} min</b>total</div></div>`;
  body += log.map((e) => `<div class="card">
    <div class="row between"><b>Week ${e.week} · Run ${e.day}${e.eased ? ' <span class="pill star">Gentler</span>' : ''}</b><span class="muted small">${fmtDate(e.date)}</span></div>
    <p>${feelBadge(e.feeling)}${e.pain ? ' · 🩹 hurt' : ''} <span class="muted small">· ${mmss(e.durationSec)}${e.completed ? '' : ' · ended early'}</span></p>
    ${e.notes ? `<p class="muted small">“${esc(e.notes)}”</p>` : ''}
    <p class="small">→ ${esc(e.change.headline)}</p></div>`).join('');
  return { title: 'History', body };
};

VIEWS.more = () => {
  const s = S.settings;
  const chk = (k, text) => `<label class="chk"><input type="checkbox" data-f="set" data-k="${k}" ${s[k] ? 'checked' : ''}> ${text}</label>`;
  const body = `<div class="card"><h3>Cues during a run</h3>
      ${chk('voice', 'Voice (“Run now for 1 minute”)')}${chk('sound', 'Beeps, plus a 3-2-1 countdown')}${chk('vibrate', 'Vibrate on each change')}${chk('keepAwake', 'Keep screen on while running')}
      <button class="block" data-a="testCue">Test cues</button></div>
    <div class="card"><h3>Program</h3><p class="muted small">You're on <b>${nextWorkout(S.state).graduated ? 'the finish line' : `Week ${nextWorkout(S.state).week}, Run ${nextWorkout(S.state).day}`}</b>. To start at a different week, pick a run in <b>Plan</b>.</p>
      <button class="block danger" data-a="restart">Start the program over</button></div>
    <div class="card"><h3>Data</h3><p class="muted small">Everything is stored on this device.</p>
      <div class="stack"><button class="block" data-a="exportData">Download backup</button>
      <label class="btn block" style="margin:0;color:var(--text);font-size:1rem">Restore backup<input type="file" accept=".json,application/json" data-f="restore" hidden></label></div></div>
    <p class="muted small" style="text-align:center"><a href="../">Open Workout Planner (strength) →</a></p>`;
  return { title: 'Settings', body };
};

// ---------- Live run ----------
const elapsedSec = (a, now = Date.now()) => Math.max(0, ((a.pausedAt ?? now) - a.startedAt + a.offsetMs) / 1000);

function startRun(w) {
  unlockAudio();
  S.active = {
    pos: w.pos, week: w.week, day: w.day, eased: w.eased, segments: w.segments,
    startedAt: Date.now(), pausedAt: null, offsetMs: 0, skipped: {},
  };
  save('active');
  go('run');
  cueIdx = 0;
  announce(0);
  keepAwake();
}

// Seconds of run intervals skipped with the Skip button, and seconds actually run.
const skippedRun = (a) => Object.entries(a.skipped).reduce((n, [i, sec]) => n + (a.segments[i].type === 'run' ? sec : 0), 0);
function runDone(a, el) {
  let t = 0, run = 0;
  for (const s of a.segments) {
    if (s.type === 'run') run += Math.max(0, Math.min(s.sec, el - t));
    t += s.sec;
  }
  return Math.max(0, run - skippedRun(a));
}

function finishRun(natural) {
  const a = S.active;
  if (!a) return;
  const t = totals(a.segments).total;
  const el = Math.min(elapsedSec(a), t);
  const plannedRunSec = totals(a.segments).run;
  const runSec = Math.round(runDone(a, el));
  const completed = runSec >= plannedRunSec * 0.9;
  S.pending = {
    pos: a.pos, week: a.week, day: a.day, eased: a.eased, durationSec: Math.round(el), runSec, plannedRunSec,
    skippedRunSec: Math.round(skippedRun(a)), completed, feeling: completed ? null : 'failed', pain: false, notes: '',
  };
  S.active = null;
  save('active', 'pending');
  releaseAwake();
  if (natural) {
    say('Workout complete. Well done! Tell me how it felt.');
    tone([523, 659, 784, 1047], 0.16);
    buzz([300, 100, 300, 100, 600]);
  }
  go('feedback');
}

let cueIdx = null, cueBeep = '', cueHalf = null;
const R = 2 * Math.PI * 54;

function tick() {
  const a = S.active;
  if (!a || view !== 'run' || !$('#phase')) return;
  const segs = a.segments;
  const el = elapsedSec(a);
  const loc = locate(segs, el);
  if (loc.done) return finishRun(true);
  const seg = segs[loc.idx];

  if (cueIdx === null) {
    cueIdx = loc.idx;
    cueHalf = loc.into >= seg.sec / 2 ? loc.idx : null;
  } else if (loc.idx !== cueIdx) {
    cueIdx = loc.idx;
    announce(loc.idx);
    const ph = $('#phase');
    ph.classList.remove('flash'); void ph.offsetWidth; ph.classList.add('flash');
  } else if (!a.pausedAt) {
    const left = Math.ceil(loc.left);
    const key = `${loc.idx}:${left}`;
    if (left >= 1 && left <= 3 && cueBeep !== key && loc.idx < segs.length - 1) {
      cueBeep = key;
      if (S.settings.sound) tone([660], 0.12);
    }
    if (seg.type === 'run' && seg.sec >= 300 && cueHalf !== loc.idx && loc.into >= seg.sec / 2) {
      cueHalf = loc.idx;
      say(`Halfway through this run. ${spoken(Math.ceil(loc.left))} to go.`);
    }
  }

  const nums = intervalNumbers(segs);
  const n = nums[loc.idx];
  const nextSeg = segs[loc.idx + 1];
  const ph = $('#phase');
  ph.className = `phase ${seg.type}${a.pausedAt ? ' paused' : ''}${ph.classList.contains('flash') ? ' flash' : ''}`;
  $('#kind').textContent = a.pausedAt ? 'Paused' : NAME[seg.type];
  $('#count').textContent = seg.type === 'warmup' ? 'Brisk walk' : seg.type === 'cooldown' ? 'Easy walk, then stretch' : n.of > 1 ? `${NAME[seg.type]} ${n.n} of ${n.of}` : seg.type === 'run' ? 'Non-stop' : '';
  $('#clock').textContent = mmss(loc.left);
  $('#of').textContent = `of ${mmss(seg.sec)}`;
  $('#arc').setAttribute('stroke-dashoffset', String((R * loc.into) / seg.sec));
  $('#next').textContent = nextSeg ? `Next: ${NAME[nextSeg.type]} ${mmss(nextSeg.sec)}` : 'Last one!';
  const t = totals(segs).total;
  $('#tl .mark').style.left = `${(el / t) * 100}%`;
  $('#tl').querySelectorAll('i').forEach((i, k) => i.classList.toggle('past', k < loc.idx));
  $('#ivs')?.querySelectorAll('li').forEach((li, k) => { li.classList.toggle('now', k === loc.idx); li.classList.toggle('past', k < loc.idx); });
  $('#el').textContent = mmss(el);
  $('#left').textContent = mmss(t - el);
  let runLeft = 0, acc = 0;
  segs.forEach((s) => { if (s.type === 'run') runLeft += Math.max(0, Math.min(s.sec, acc + s.sec - el)); acc += s.sec; });
  $('#runLeft').textContent = mmss(runLeft);
  $('#pp').textContent = a.pausedAt ? '▶ Resume' : '⏸ Pause';
  $('#clockNow').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
setInterval(tick, 250);

function control(kind) {
  const a = S.active;
  if (!a) return;
  const now = Date.now();
  const loc = locate(a.segments, elapsedSec(a, now));
  if (kind === 'pause') {
    if (a.pausedAt) { a.offsetMs -= now - a.pausedAt; a.pausedAt = null; say('Resuming.'); keepAwake(); }
    else { a.pausedAt = now; say('Paused.'); }
  } else if (kind === 'skip') {
    a.skipped[loc.idx] = loc.left;
    a.offsetMs += loc.left * 1000 + 1;
  } else if (kind === 'back') {
    const into = loc.into < 3 && loc.idx > 0 ? loc.into + a.segments[loc.idx - 1].sec : loc.into;
    a.offsetMs -= into * 1000;
    delete a.skipped[locate(a.segments, elapsedSec(a, now)).idx];
  }
  save('active');
  tick();
}

// ---------- Cues ----------
function spoken(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  const parts = [];
  if (m) parts.push(`${m} minute${m === 1 ? '' : 's'}`);
  if (s) parts.push(`${s} seconds`);
  return parts.join(' ') || '0 seconds';
}

function announce(idx) {
  const a = S.active;
  if (!a) return;
  const s = a.segments[idx], n = intervalNumbers(a.segments)[idx];
  const text = {
    warmup: `Let's go. Warm up with a brisk walk for ${spoken(s.sec)}.`,
    run: `Run now, for ${spoken(s.sec)}.${n?.of > 1 ? ` Run ${n.n} of ${n.of}.` : ''}`,
    walk: `Walk for ${spoken(s.sec)}.${n?.of > 1 && n.n === n.of ? ' Last walk.' : ''}`,
    cooldown: `Great work! Walk for ${spoken(s.sec)} to cool down.`,
  }[s.type];
  say(text);
  if (s.type === 'run') { tone([784, 1047], 0.18); buzz([400, 150, 400]); }
  else { tone([784, 523], 0.18); buzz([250]); }
}

function say(text) {
  if (!S.settings.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.02;
    speechSynthesis.speak(u);
  } catch { /* no speech */ }
}

let actx = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { /* no audio */ }
}
document.addEventListener('pointerdown', unlockAudio, { once: true });

function tone(freqs, len) {
  if (!S.settings.sound || !actx) return;
  const t0 = actx.currentTime;
  freqs.forEach((f, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    const t = t0 + i * (len + 0.06);
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + len + 0.05);
  });
}
const buzz = (p) => { if (S.settings.vibrate && navigator.vibrate) navigator.vibrate(p); };

let wakeLock = null;
async function keepAwake() {
  if (!S.active || !S.settings.keepAwake || !('wakeLock' in navigator) || document.hidden) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* denied */ }
}
function releaseAwake() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { keepAwake(); tick(); }
});

// ---------- Actions ----------
const ACTIONS = {
  start() { startRun(nextWorkout(S.state)); },
  startBonus() {
    const pos = TOTAL - 1;
    startRun({ pos, week: PLAN[pos].week, day: PLAN[pos].day, eased: false, segments: withWarmup(PLAN[pos].main) });
  },
  pause() { control('pause'); },
  skip() { control('skip'); },
  back() { control('back'); },
  end() { if (confirm('End this run now?')) finishRun(false); },
  feel(el) {
    S.pending.feeling = el.dataset.v; save('pending');
    document.querySelectorAll('.feel button').forEach((b) => b.classList.toggle('on', b === el));
    $('[data-a="saveFeedback"]').disabled = false;
  },
  saveFeedback() {
    const p = S.pending;
    if (!p?.feeling) return;
    S.undo = S.state;
    const { state, change } = applyFeedback(S.state, p, new Date());
    S.state = state; S.pending = null;
    save('state', 'pending', 'undo');
    go('today');
    toast(change.headline, 3500);
  },
  discard() {
    if (!confirm('Discard this run? It won\'t be logged and the plan won\'t change.')) return;
    S.pending = null; save('pending'); go('today');
  },
  undo() {
    if (!S.undo || !confirm('Undo the last logged run and put the plan back?')) return;
    S.state = S.undo; S.undo = null; save('state', 'undo'); render(); toast('Last entry removed');
  },
  viewRun(el) { go('planRun', +el.dataset.pos); },
  toPlan() { go('plan'); },
  setPos(el) {
    const pos = +el.dataset.pos;
    if (!confirm(`Make Week ${PLAN[pos].week}, Run ${PLAN[pos].day} your next run?`)) return;
    S.state = setPosition(S.state, pos); S.undo = null; save('state', 'undo'); go('today'); toast('Plan updated');
  },
  restart() {
    if (!confirm('Start again from Week 1? Your run history is kept.')) return;
    S.state = setPosition(S.state, 0); S.undo = null; save('state', 'undo'); go('today');
  },
  testCue() {
    unlockAudio();
    say('Run now, for 1 minute.');
    tone([784, 1047], 0.18);
    buzz([400, 150, 400]);
  },
  exportData() {
    const data = { app: 'couch-to-5k', exported: new Date().toISOString(), settings: S.settings, state: S.state };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `c25k-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};

document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tabs button');
  if (tab) return go(tab.dataset.tab);
  const el = e.target.closest('[data-a]');
  if (el && ACTIONS[el.dataset.a]) ACTIONS[el.dataset.a](el);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.f === 'notes' && S.pending) {
    S.pending.notes = el.value; save('pending');
    $('#painHint').classList.toggle('hidden', !painMentioned(el.value) || S.pending.pain);
  }
});

document.addEventListener('change', (e) => {
  const el = e.target, f = el.dataset.f;
  if (f === 'pain' && S.pending) {
    S.pending.pain = el.checked; save('pending');
    $('#painHint').classList.toggle('hidden', !painMentioned(S.pending.notes) || el.checked);
  } else if (f === 'set') {
    S.settings[el.dataset.k] = el.checked; save('settings');
  } else if (f === 'restore' && el.files[0]) {
    el.files[0].text().then((t) => {
      const d = JSON.parse(t);
      if (d.app !== 'couch-to-5k' || !Array.isArray(d.state?.log)) throw new Error();
      if (!confirm('Replace your current plan and history with this backup?')) return;
      S.settings = { ...DEFAULTS, ...d.settings }; S.state = { ...newState(), ...d.state }; S.undo = null;
      save('settings', 'state', 'undo');
      toast('Backup restored'); go('today');
    }).catch(() => toast('That is not a valid backup file.'));
  }
});

// ---------- Boot ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (S.active) keepAwake();
render();
