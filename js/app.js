import {
  DEFAULT_SETTINGS, uid, parseHevyCSV, routinesFromHistory, hevyApiRoutine, hevyApiWorkout, mergeHistory,
  workingSets, e1rm, exerciseHistory, progressionAdvice, setStr, estimateMinutes, maxSetsFor,
  startOfWeek, workoutsThisWeek, suggestNext, routineFocus,
} from './logic.js';
import { alternativesFor, searchLibrary, PATTERNS, EQUIPMENT, findExercise, norm } from './exercises.js';
import { PROGRAMS } from './programs.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const fmtDate = (iso, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(iso).toLocaleDateString(undefined, opts);
const mmss = (ms) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const toNum = (v) => (v === '' || v == null ? 0 : parseFloat(v) || 0);

// ---------- Storage ----------
const store = {
  load(k, d) {
    try {
      const v = localStorage.getItem('wp.' + k);
      return v ? JSON.parse(v) : d;
    } catch { return d; }
  },
  save(k, v) {
    try { localStorage.setItem('wp.' + k, JSON.stringify(v)); } catch { toast('Could not save — storage may be full.'); }
  },
};
const S = {
  settings: { ...DEFAULT_SETTINGS, ...store.load('settings', {}) },
  routines: store.load('routines', []),
  history: store.load('history', []),
  schedule: store.load('schedule', {}),
  active: store.load('active', null),
  timer: store.load('timer', null),
};
const save = (...keys) => keys.forEach((k) => store.save(k, S[k]));
const U = () => S.settings.unit;

// ---------- Navigation ----------
let view = S.active ? 'workout' : 'today';
let param = null;
let sheet = null;
let importState = null;

function go(v, p = null, push = true) {
  view = v; param = p; sheet = null;
  if (push) history.pushState({ v, p }, '');
  render();
  window.scrollTo(0, 0);
}
window.addEventListener('popstate', (e) => {
  const st = e.state || { v: 'today' };
  go(st.v, st.p, false);
});
history.replaceState({ v: view, p: null }, '');

const TAB_OF = { today: 'today', workout: 'today', plan: 'plan', edit: 'plan', import: 'plan', history: 'history', exercise: 'history', more: 'more' };

function render() {
  const out = (VIEWS[view] || VIEWS.today)(param);
  $('#title').textContent = out.title;
  $('#topAction').innerHTML = out.action || '';
  $('#main').innerHTML = out.body;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === TAB_OF[view]));
  renderTimer();
  renderSheet();
}

let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- Helpers ----------
const routineById = (id) => S.routines.find((r) => r.id === id);
const totalSets = (r) => r.exercises.reduce((a, e) => a + (+e.sets || 0), 0);

function estPill(r) {
  const m = estimateMinutes(r, S.settings.restSec);
  const over = m > S.settings.targetMin + 5;
  return `<span class="pill ${over ? 'over' : ''}" id="est">~${m} min</span>`;
}

function statusPill(adv) {
  if (adv.status === 'up') return '<span class="pill up">↑ Move up</span>';
  if (adv.status === 'stalled') return '<span class="pill stalled">Stalled</span>';
  return '';
}

// Rep-range info for any exercise: from a routine that has it, else default.
function planFor(name) {
  for (const r of S.routines) {
    const e = r.exercises.find((x) => norm(x.name) === norm(name));
    if (e) return e;
  }
  return { name, sets: 3, repMin: 8, repMax: 12 };
}

function progressList() {
  const seen = new Set(), out = [];
  for (const r of S.routines) {
    for (const e of r.exercises) {
      if (seen.has(norm(e.name))) continue;
      seen.add(norm(e.name));
      const adv = progressionAdvice(S.history, e, U());
      if (adv.status === 'up' || adv.status === 'stalled') out.push({ e, adv, routine: r });
    }
  }
  return out.sort((a, b) => (a.adv.status === 'up' ? -1 : 1) - (b.adv.status === 'up' ? -1 : 1));
}

// ---------- Views ----------
const VIEWS = {};

VIEWS.today = () => {
  const now = new Date();
  const wk = workoutsThisWeek(S.history, now);
  const goal = S.settings.daysPerWeek;
  const monday = startOfWeek(now);
  const doneDays = new Set(wk.map((w) => new Date(w.date).toDateString()));
  const strip = WEEK.map((dow, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const cls = [doneDays.has(d.toDateString()) ? 'done' : '', S.schedule[dow] ? 'plan' : '', d.toDateString() === now.toDateString() ? 'today' : ''].join(' ');
    return `<div class="d ${cls}">${DAYS[dow][0]}<b>${d.getDate()}</b></div>`;
  }).join('');

  let body = `<div class="card"><div class="row between"><h3>This week</h3><span class="pill ${wk.length >= goal ? 'up' : ''}">${wk.length} / ${goal} workouts</span></div>
    <div class="week" style="margin-top:10px">${strip}</div></div>`;

  if (S.active) {
    const done = S.active.exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
    body += `<div class="card hl"><h3>Workout in progress</h3><p class="muted">${esc(S.active.name)} · ${done} sets done</p>
      <button class="primary block" data-a="resume">Resume workout</button></div>`;
  }

  if (!S.routines.length) {
    body += `<div class="card"><h3>Get started</h3><p class="muted">Bring in your routines and history from Hevy, or start with a program built for ~45-minute sessions.</p>
      <div class="stack" style="margin-top:10px"><button class="primary block" data-a="goImport">Import from Hevy</button>
      <button class="block" data-a="programs">Use a starter program</button>
      <button class="block" data-a="newRoutine">Build my own routine</button></div></div>`;
    return { title: 'Today', body };
  }

  const next = suggestNext(S.routines, S.history, S.schedule, now);
  const doneToday = doneDays.has(now.toDateString());
  if (next && !S.active) {
    const r = next.routine;
    body += `<h2>${doneToday ? 'Already trained today 💪 — next up' : 'Up next'}</h2>
      <div class="card hl"><div class="row between"><h3>${esc(r.name)}</h3>${estPill(r)}</div>
      <p class="muted small">${esc(next.reason)} · ${plural(r.exercises.length, 'exercise')} · ${totalSets(r)} sets · ${routineFocus(r).join(', ')}</p>
      <p class="small">${r.exercises.map((e) => esc(e.name)).join(' · ')}</p>
      <button class="primary block" data-a="start" data-id="${r.id}" style="margin-top:8px">Start workout</button></div>`;
  }

  const prog = progressList();
  if (prog.length) {
    body += `<h2>Progress check</h2><div class="card">` + prog.slice(0, 10).map(({ e, adv }) => `
      <div class="advice ${adv.status}"><div class="row between"><b>${esc(e.name)}</b>${statusPill(adv)}</div>${esc(adv.message)}</div>`).join('') + `</div>`;
  }

  const others = S.routines.filter((r) => r !== next?.routine);
  if (others.length && !S.active) {
    body += `<h2>Other routines</h2>` + others.map((r) => `
      <div class="card"><div class="row"><div class="grow"><b>${esc(r.name)}</b><div class="muted small">${plural(r.exercises.length, 'exercise')} · ~${estimateMinutes(r, S.settings.restSec)} min</div></div>
      <button class="sm" data-a="start" data-id="${r.id}">Start</button></div></div>`).join('');
  }
  if (!S.active) body += `<button class="block ghost" data-a="startEmpty" style="margin-top:8px">+ Start an empty workout</button>`;
  return { title: 'Today', body };
};

VIEWS.workout = () => {
  const a = S.active;
  if (!a) { view = 'today'; return VIEWS.today(); }
  const U_ = U();
  let body = `<div class="card"><div class="row between"><div><b id="elapsed">${elapsedStr()}</b><div class="muted small" id="proj">${projStr()}</div></div>
    <button class="good" data-a="finish">Finish</button></div></div>`;

  a.exercises.forEach((ex, ei) => {
    const adv = ex.advice || {};
    const rows = ex.sets.map((s, si) => `
      <tr id="set-${ei}-${si}" class="${s.done ? 'done' : ''} ${s.type === 'warmup' ? 'warmup' : ''}">
        <td class="n" data-a="cycleType" data-ei="${ei}" data-si="${si}" title="Tap to mark warm-up">${s.type === 'warmup' ? 'W' : ex.sets.slice(0, si + 1).filter((x) => x.type !== 'warmup').length}</td>
        <td class="prev">${esc(ex.prev?.[si] || '—')}</td>
        <td><input data-f="w" data-ei="${ei}" data-si="${si}" inputmode="decimal" type="text" value="${esc(s.weight)}" placeholder="${U_}" aria-label="weight"></td>
        <td><input data-f="r" data-ei="${ei}" data-si="${si}" inputmode="numeric" type="text" pattern="[0-9]*" value="${esc(s.reps)}" placeholder="${ex.repMin}–${ex.repMax}" aria-label="reps"></td>
        <td><button class="check" data-a="setDone" data-ei="${ei}" data-si="${si}" aria-label="complete set">✓</button></td>
      </tr>`).join('');
    let advBtn = '';
    if (adv.status === 'up' && adv.lastWeight) advBtn = `<button class="sm" data-a="applyW" data-ei="${ei}" data-w="${adv.lastWeight}">Use last (${adv.lastWeight})</button>`;
    if (adv.status === 'stalled' && adv.suggestedWeight) advBtn = `<button class="sm" data-a="applyW" data-ei="${ei}" data-w="${adv.suggestedWeight}">Use ${adv.suggestedWeight} (deload)</button>`;
    body += `<div class="card">
      <div class="ex-head"><h3>${esc(ex.name)}</h3>${statusPill(adv)}
        <button class="sm" data-a="swap" data-ctx="w" data-ei="${ei}" aria-label="swap exercise">⇄ Swap</button>
        <button class="sm ghost" data-a="exMenu" data-ei="${ei}" aria-label="more">⋯</button></div>
      <div class="muted small">Target ${ex.sets.filter((s) => s.type !== 'warmup').length} × ${ex.repMin}–${ex.repMax} reps · rest ${mmss((ex.rest || S.settings.restSec) * 1000)}</div>
      ${adv.message ? `<div class="advice ${adv.status}">${esc(adv.message)} ${advBtn}</div>` : ''}
      ${ex.notes ? `<p class="muted small">📝 ${esc(ex.notes)}</p>` : ''}
      <table class="sets"><thead><tr><th>Set</th><th>Last</th><th>${U_}</th><th>Reps</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="row" style="margin-top:8px"><button class="sm grow" data-a="addSet" data-ei="${ei}">+ Add set</button><button class="sm grow" data-a="removeSet" data-ei="${ei}">− Remove set</button></div>
    </div>`;
  });
  body += `<button class="block" data-a="addEx" data-ctx="w">+ Add exercise</button>
    <div class="row" style="margin-top:12px"><button class="good grow" data-a="finish">Finish workout</button><button class="danger" data-a="discard">Discard</button></div>`;
  return { title: a.name, body };
};

function elapsedStr() {
  if (!S.active) return '';
  const min = Math.floor((Date.now() - new Date(S.active.startedAt)) / 60000);
  const sets = S.active.exercises.flatMap((e) => e.sets);
  return `⏱ ${min} min · ${sets.filter((s) => s.done).length}/${sets.length} sets`;
}
function projStr() {
  if (!S.active) return '';
  const min = (Date.now() - new Date(S.active.startedAt)) / 60000;
  let left = 0;
  for (const e of S.active.exercises) for (const s of e.sets) if (!s.done) left += 0.75 + (e.rest || S.settings.restSec) / 60;
  const total = Math.round(min + left);
  const over = total > S.settings.targetMin + 5;
  return `Projected ${total} min${over ? ` — over your ${S.settings.targetMin} min target; consider dropping a set` : ''}`;
}

VIEWS.plan = () => {
  const s = S.settings;
  const fit = maxSetsFor(s.targetMin, s.restSec);
  const sched = WEEK.map((dow) => `
    <div class="row" style="margin:6px 0"><div style="width:48px" class="muted">${DAYS[dow]}</div>
    <select data-f="sched" data-dow="${dow}" class="grow"><option value="">Rest</option>
    ${S.routines.map((r) => `<option value="${r.id}" ${S.schedule[dow] === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>`).join('');
  const planned = Object.values(S.schedule).filter((id) => routineById(id)).length;

  let body = `<div class="card"><h3>Weekly goal</h3>
    <div class="chips">${[3, 4].map((n) => `<button class="${s.daysPerWeek === n ? 'on' : ''}" data-a="setDays" data-n="${n}">${n} days / week</button>`).join('')}</div>
    <p class="muted small">At ${mmss(s.restSec * 1000)} rest, about <b>${fit} working sets</b> fit in ${s.targetMin} min (incl. a short warm-up). 4 exercises × 3 sets is the sweet spot.</p></div>`;

  body += `<h2>Routines</h2>`;
  if (!S.routines.length) body += `<p class="muted">No routines yet.</p>`;
  body += S.routines.map((r) => `
    <div class="card"><div class="row between"><h3>${esc(r.name)}</h3>${estPill(r)}</div>
    <p class="muted small">${plural(r.exercises.length, 'exercise')} · ${totalSets(r)} sets · ${routineFocus(r).join(', ') || '—'}</p>
    <div class="row" style="margin-top:8px"><button class="sm primary grow" data-a="start" data-id="${r.id}">Start</button><button class="sm grow" data-a="editRoutine" data-id="${r.id}">Edit</button></div></div>`).join('');
  body += `<div class="stack" style="margin-top:10px"><button class="block" data-a="newRoutine">+ New routine</button>
    <button class="block" data-a="goImport">Import from Hevy</button><button class="block" data-a="programs">Starter programs</button></div>`;

  body += `<h2>Weekly schedule</h2><div class="card">${S.routines.length ? sched : '<p class="muted">Add routines first.</p>'}
    ${S.routines.length && planned !== s.daysPerWeek ? `<p class="muted small">You've scheduled ${planned} day${planned === 1 ? '' : 's'}; your goal is ${s.daysPerWeek}. Leave a rest day between hard sessions for the same muscles.</p>` : ''}</div>`;
  return { title: 'Plan', body };
};

VIEWS.edit = (id) => {
  const r = routineById(id);
  if (!r) return VIEWS.plan();
  const exs = r.exercises.map((e, i) => `
    <div class="card"><div class="ex-head"><h3>${esc(e.name)}</h3>
      <button class="sm" data-a="swap" data-ctx="r" data-ei="${i}">⇄ Swap</button></div>
      <div class="edit-ex">
        <div><label>Sets</label><input data-f="re" data-k="sets" data-ei="${i}" inputmode="numeric" value="${e.sets}"></div>
        <div><label>Min reps</label><input data-f="re" data-k="repMin" data-ei="${i}" inputmode="numeric" value="${e.repMin}"></div>
        <div><label>Max reps</label><input data-f="re" data-k="repMax" data-ei="${i}" inputmode="numeric" value="${e.repMax}"></div>
      </div>
      <label>Rest (seconds, blank = default ${S.settings.restSec})</label><input data-f="re" data-k="rest" data-ei="${i}" inputmode="numeric" value="${e.rest || ''}">
      <div class="row" style="margin-top:8px"><button class="sm" data-a="moveEx" data-ei="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="sm" data-a="moveEx" data-ei="${i}" data-d="1" ${i === r.exercises.length - 1 ? 'disabled' : ''}>↓</button>
      <span class="grow"></span><button class="sm danger" data-a="rmRoutineEx" data-ei="${i}">Remove</button></div>
    </div>`).join('');
  const body = `<label>Routine name</label><input data-f="rname" value="${esc(r.name)}">
    <div class="row between" style="margin-top:10px"><span class="muted small">${plural(r.exercises.length, 'exercise')} · <span id="sets">${totalSets(r)}</span> sets</span>${estPill(r)}</div>
    ${exs}
    <button class="block" data-a="addEx" data-ctx="r">+ Add exercise</button>
    <div class="stack" style="margin-top:14px"><button class="primary block" data-a="start" data-id="${r.id}">Start this workout</button>
    <div class="row"><button class="grow" data-a="dupRoutine">Duplicate</button><button class="grow danger" data-a="delRoutine">Delete</button></div></div>`;
  return { title: 'Edit routine', body, action: `<button class="sm" data-a="tab" data-tab="plan">Done</button>` };
};

VIEWS.history = (tab = 'workouts') => {
  const h = S.history;
  const recent = h.slice(-10).filter((w) => w.durationMin);
  const avg = recent.length ? Math.round(recent.reduce((a, w) => a + w.durationMin, 0) / recent.length) : null;
  let body = `<div class="card"><div class="row between"><div><b>${h.length}</b> <span class="muted">workouts</span></div>
    <div><b>${workoutsThisWeek(h).length}</b> <span class="muted">this week</span></div>${avg ? `<div><b>${avg}</b> <span class="muted">avg min</span></div>` : ''}</div></div>
    <div class="chips"><button class="${tab !== 'exercises' ? 'on' : ''}" data-a="histTab" data-t="workouts">Workouts</button><button class="${tab === 'exercises' ? 'on' : ''}" data-a="histTab" data-t="exercises">Exercises</button></div>`;
  if (!h.length) return { title: 'History', body: body + `<p class="muted">Finished workouts show up here. You can also import your Hevy history from the Plan tab.</p>` };

  if (tab === 'exercises') {
    const last = new Map();
    for (const w of h) for (const e of w.exercises) if (workingSets(e).length) last.set(norm(e.name), { name: e.name, date: w.date });
    const list = [...last.values()].sort((a, b) => b.date.localeCompare(a.date));
    body += list.map(({ name, date }) => {
      const adv = progressionAdvice(h, planFor(name), U());
      const best = adv.lastSets ? adv.lastSets.reduce((b, s) => (e1rm(s.weight, s.reps) > e1rm(b.weight, b.reps) ? s : b)) : null;
      return `<button class="list-item" data-a="exercise" data-name="${esc(name)}"><div class="row between"><span class="t">${esc(name)}</span>${statusPill(adv)}</div>
        <div class="muted small">${fmtDate(date)}${best ? ' · top set ' + setStr(best) : ''}</div></button>`;
    }).join('');
    return { title: 'History', body };
  }

  const limit = histLimit;
  body += [...h].reverse().slice(0, limit).map((w) => {
    const sets = w.exercises.reduce((a, e) => a + workingSets(e).length, 0);
    return `<details class="card"><summary><div class="row between"><b>${esc(w.name)}</b><span class="muted small">${fmtDate(w.date)}</span></div>
      <div class="muted small">${w.durationMin ? w.durationMin + ' min · ' : ''}${plural(w.exercises.length, 'exercise')} · ${sets} sets${w.source === 'hevy' ? ' · from Hevy' : ''}</div></summary>
      ${w.exercises.map((e) => `<div class="kv"><span>${esc(e.name)}</span><span class="muted">${e.sets.filter((s) => s.type !== 'warmup').map(setStr).join(', ')}</span></div>`).join('')}
      <button class="sm danger" data-a="delHist" data-id="${w.id}" style="margin-top:8px">Delete</button></details>`;
  }).join('');
  if (h.length > limit) body += `<button class="block" data-a="moreHist">Show more</button>`;
  return { title: 'History', body };
};
let histLimit = 40;

VIEWS.exercise = (name) => {
  const plan = planFor(name);
  const adv = progressionAdvice(S.history, plan, U());
  const hist = exerciseHistory(S.history, name);
  const best = Math.max(0, ...hist.flatMap((x) => x.sets.map((s) => e1rm(s.weight, s.reps))));
  const lib = findExercise(name);
  const body = `<div class="card"><div class="row between"><span class="muted small">Target ${plan.repMin}–${plan.repMax} reps</span>${statusPill(adv)}</div>
    <div class="advice ${adv.status}">${esc(adv.message)}</div>
    ${best ? `<p class="small muted">Best estimated 1-rep max: <b>${Math.round(best)} ${U()}</b></p>` : ''}
    ${lib ? `<p class="small muted">${esc(lib.note)}</p>` : ''}
    <button class="block sm" data-a="swap" data-ctx="x" data-name="${esc(name)}">See alternatives</button></div>
    <h2>Sessions</h2>` + hist.slice(0, 60).map((x) => `<div class="kv"><span>${fmtDate(x.date)}</span><span class="muted">${x.sets.map(setStr).join(', ')}</span></div>`).join('');
  return { title: name, body, action: `<button class="sm" data-a="histTab" data-t="exercises">Back</button>` };
};

VIEWS.more = () => {
  const s = S.settings;
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const body = `<div class="card"><h3>Workout</h3>
    <label>Rest between sets</label><select data-f="set" data-k="restSec">
      ${[60, 90, 120, 150, 180, 210, 240, 300].map((v) => `<option value="${v}" ${s.restSec === v ? 'selected' : ''}>${mmss(v * 1000)}</option>`).join('')}</select>
    <label>Session length target (minutes)</label><input data-f="set" data-k="targetMin" inputmode="numeric" value="${s.targetMin}">
    <label>Units</label><select data-f="set" data-k="unit"><option value="lb" ${s.unit === 'lb' ? 'selected' : ''}>lb</option><option value="kg" ${s.unit === 'kg' ? 'selected' : ''}>kg</option></select>
    <label class="chk"><input type="checkbox" data-f="set" data-k="sound" ${s.sound ? 'checked' : ''}> Beep when rest is over</label>
    <label class="chk"><input type="checkbox" data-f="set" data-k="vibrate" ${s.vibrate ? 'checked' : ''}> Vibrate when rest is over</label>
    <label class="chk"><input type="checkbox" data-f="set" data-k="keepAwake" ${s.keepAwake ? 'checked' : ''}> Keep screen on during workouts</label></div>

    <div class="card"><h3>Notifications</h3><p class="muted small">Status: <b>${perm}</b>. Notifications alert you when rest ends while the app is in the background. On iPhone, add this app to your Home Screen first (Share → Add to Home Screen).</p>
    <div class="row"><button class="grow" data-a="notifPerm">Enable</button><button class="grow" data-a="testAlarm">Test alert (5s)</button></div></div>

    <div class="card"><h3>Data</h3><p class="muted small">Everything is stored on this device. Back up regularly.</p>
    <div class="stack"><button class="block" data-a="goImport">Import from Hevy</button><button class="block" data-a="exportData">Download backup</button>
    <label class="btn block" style="margin:0;color:var(--text);font-size:1rem">Restore backup<input type="file" accept=".json,application/json" data-f="restore" hidden></label>
    <button class="block danger" data-a="clearAll">Erase all data</button></div></div>
    <p class="muted small" style="text-align:center">Workout Planner · works offline</p>`;
  return { title: 'Settings', body };
};

VIEWS.import = () => {
  let body = `<div class="card"><h3>1. Export from Hevy</h3><ol class="steps small">
    <li>Open Hevy → <b>Profile</b> → ⚙️ <b>Settings</b></li><li>Tap <b>Export &amp; Import Data</b> → <b>Export Workouts</b></li>
    <li>Save the <b>.csv</b> file to your phone (Files / Downloads)</li></ol>
    <h3 style="margin-top:12px">2. Choose the file</h3>
    <label class="btn block primary" style="margin-top:8px;color:#fff;font-size:1rem">Choose Hevy CSV<input type="file" accept=".csv,text/csv,text/plain" data-f="csv" hidden></label></div>`;

  if (importState) {
    const { workouts, candidates, selected } = importState;
    const first = workouts[0]?.date, last = workouts[workouts.length - 1]?.date;
    body += `<div class="card hl"><h3>Found ${workouts.length} workouts</h3>
      ${first ? `<p class="muted small">${fmtDate(first, { month: 'short', day: 'numeric', year: 'numeric' })} – ${fmtDate(last, { month: 'short', day: 'numeric', year: 'numeric' })}</p>` : ''}
      <label class="chk"><input type="checkbox" data-f="impHist" ${importState.withHistory ? 'checked' : ''}> Import workout history (used for progress tracking)</label>
      <h2>Create routines from</h2>
      ${candidates.map((c) => `<label class="chk"><input type="checkbox" data-f="impSel" data-id="${c.id}" ${selected.has(c.id) ? 'checked' : ''}>
        <span class="grow">${esc(c.name)}<br><span class="muted small">done ${c.timesDone}× · ${plural(c.exercises.length, 'exercise')} · ~${estimateMinutes(c, S.settings.restSec)} min</span></span></label>`).join('')}
      <button class="primary block" data-a="doImport" style="margin-top:10px">Import</button></div>`;
  }

  body += `<details class="card"><summary><b>Have Hevy Pro? Import with an API key</b><div class="muted small">Pulls your saved routines directly.</div></summary>
    <p class="muted small">Get your key at hevy.com → Settings → Developer. The key is only used for this import and is not saved.</p>
    <input data-f="apikey" id="apikey" placeholder="API key" autocomplete="off">
    <label class="chk"><input type="checkbox" id="apiHist"> Also import workout history</label>
    <button class="block" data-a="hevyApi">Fetch from Hevy</button><p class="small muted" id="apiMsg"></p></details>`;
  return { title: 'Import from Hevy', body, action: `<button class="sm" data-a="tab" data-tab="plan">Back</button>` };
};

// ---------- Sheet (bottom modal) ----------
function openSheet(s) {
  sheet = s;
  renderSheet();
}
function closeSheet() {
  sheet = null;
  renderSheet();
}

function sheetExerciseName() {
  const c = sheet.ctx;
  if (c === 'w') return S.active.exercises[sheet.ei].name;
  if (c === 'r') return routineById(param).exercises[sheet.ei].name;
  return sheet.name;
}

function libItem(e, action) {
  return `<button class="list-item" data-a="${action}" data-name="${esc(e.name)}"><div class="row between"><span class="t">${esc(e.name)}</span>
    <span>${e.star ? '<span class="pill star">★ Top pick</span> ' : ''}<span class="pill">${e.equip}</span></span></div>
    <div class="muted small">${esc(e.note)}</div></button>`;
}

function renderSheet() {
  const el = $('#sheet');
  if (!sheet) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  let html = '';
  if (sheet.type === 'swap') {
    const name = sheetExerciseName();
    const { pattern, items } = alternativesFor(name, sheet.equip || []);
    const same = items.filter((i) => i.relation === 'same'), rel = items.filter((i) => i.relation === 'related');
    const pick = sheet.ctx === 'x' ? 'noop' : 'pickSwap';
    html = `<div class="row between"><h3>Alternatives</h3><button class="sm" data-a="closeSheet">Close</button></div>
      <p class="muted small">For <b>${esc(name)}</b>${pattern ? ` · ${PATTERNS[pattern].label}` : ''}. ★ = strong default pick.</p>
      <div class="chips">${EQUIPMENT.map((q) => `<button class="${(sheet.equip || []).includes(q) ? 'on' : ''}" data-a="eqFilter" data-q="${q}">${q}</button>`).join('')}</div>
      ${!pattern ? `<p class="muted">I don't recognize this exercise — search below.</p>` : ''}
      ${same.map((e) => libItem(e, pick)).join('') || (pattern ? '<p class="muted small">No matches for that equipment.</p>' : '')}
      ${rel.length ? `<h2>Also trains these muscles</h2>${rel.map((e) => libItem(e, pick)).join('')}` : ''}
      ${sheet.ctx !== 'x' ? `<h2>Search all exercises</h2><input data-f="q" placeholder="Search…" value="${esc(sheet.q || '')}"><div id="sheetList"></div>` : ''}`;
  } else if (sheet.type === 'add') {
    html = `<div class="row between"><h3>Add exercise</h3><button class="sm" data-a="closeSheet">Close</button></div>
      <input data-f="q" placeholder="Search e.g. row, curl, squat…" value="${esc(sheet.q || '')}"><div id="sheetList"></div>`;
  } else if (sheet.type === 'programs') {
    html = `<div class="row between"><h3>Starter programs</h3><button class="sm" data-a="closeSheet">Close</button></div>
      <p class="muted small">Each session is 4 exercises × 3 sets ≈ 45 min with 3-min rests. Uses double progression: when you hit the top of the rep range on every set, the app tells you to add weight.</p>` +
      PROGRAMS.map((p) => `<div class="card"><h3>${p.name}</h3><p class="muted small">${p.blurb}</p>
        ${p.routines.map((r) => `<p class="small"><b>${r.name}:</b> ${r.exercises.map((e) => e.name).join(', ')}</p>`).join('')}
        <button class="primary block" data-a="installProgram" data-id="${p.id}">Use this program</button></div>`).join('');
  } else if (sheet.type === 'exMenu') {
    const ex = S.active.exercises[sheet.ei];
    html = `<div class="row between"><h3>${esc(ex.name)}</h3><button class="sm" data-a="closeSheet">Close</button></div>
      <div class="stack"><button class="block" data-a="moveActive" data-d="-1">Move up</button><button class="block" data-a="moveActive" data-d="1">Move down</button>
      <button class="block" data-a="exercise" data-name="${esc(ex.name)}">View history</button>
      <button class="block danger" data-a="rmActiveEx">Remove from this workout</button></div>`;
  } else if (sheet.type === 'summary') {
    const d = sheet.data;
    html = `<h3>Workout saved 🎉</h3><p class="muted">${esc(d.name)} · ${d.minutes} min · ${d.sets} sets · ${Math.round(d.volume).toLocaleString()} ${U()} volume</p>
      ${d.prs.length ? `<h2>Personal records</h2>${d.prs.map((p) => `<div class="advice up">🏆 ${esc(p.name)}: ${esc(p.set)}</div>`).join('')}` : ''}
      ${d.ups.length ? `<h2>Move up next time</h2>${d.ups.map((u) => `<div class="advice up"><b>${esc(u.name)}</b> — ${esc(u.message)}</div>`).join('')}` : ''}
      ${d.changed ? `<div class="card"><p class="small">You swapped or added exercises. Update the <b>${esc(d.routineName)}</b> routine to match?</p><button class="block" data-a="saveToRoutine">Update routine</button></div>` : ''}
      <button class="primary block" data-a="closeSheet" style="margin-top:12px">Done</button>`;
  }
  el.innerHTML = `<div class="panel">${html}</div>`;
  renderSheetList();
}

function renderSheetList() {
  const list = $('#sheetList');
  if (!list || !sheet) return;
  const q = sheet.q || '';
  if (sheet.type === 'swap' && !q.trim()) { list.innerHTML = ''; return; }
  const items = searchLibrary(q).slice(0, 40);
  const action = sheet.type === 'add' ? 'pickAdd' : 'pickSwap';
  list.innerHTML = (q.trim() ? `<button class="list-item" data-a="${action}" data-name="${esc(q.trim())}"><span class="t">+ Use “${esc(q.trim())}”</span><div class="muted small">Custom exercise</div></button>` : '') +
    items.map((e) => libItem(e, action)).join('');
}

// ---------- Workout actions ----------
function buildActiveEx(e) {
  const adv = progressionAdvice(S.history, e, U());
  const w = adv.status === 'up' ? adv.suggestedWeight ?? adv.lastWeight : adv.lastWeight;
  const n = Math.max(1, +e.sets || 3);
  return {
    name: e.name,
    repMin: +e.repMin || 8,
    repMax: +e.repMax || 12,
    rest: +e.rest || undefined,
    notes: e.notes,
    advice: { status: adv.status, message: adv.message, suggestedWeight: adv.suggestedWeight, lastWeight: adv.lastWeight },
    prev: (adv.lastSets || []).map(setStr),
    sets: Array.from({ length: n }, () => ({ weight: w ? w : '', reps: '', done: false, type: 'normal' })),
  };
}

function startWorkout(r) {
  if (S.active && !confirm('You have a workout in progress. Discard it and start a new one?')) return;
  S.active = {
    id: uid(), routineId: r?.id || null, name: r?.name || 'Quick workout', startedAt: new Date().toISOString(),
    exercises: (r?.exercises || []).map(buildActiveEx),
  };
  S.timer = null;
  save('active', 'timer');
  unlockAudio();
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  keepAwake();
  go('workout');
}

function nextUp(ei, si) {
  const ex = S.active.exercises;
  for (let e = ei; e < ex.length; e++) {
    for (let s = e === ei ? si + 1 : 0; s < ex[e].sets.length; s++) if (!ex[e].sets[s].done) return { ei: e, si: s };
  }
  for (let e = 0; e <= ei; e++) {
    for (let s = 0; s < ex[e].sets.length; s++) if (!ex[e].sets[s].done) return { ei: e, si: s };
  }
  return null;
}

function setLabel(ei, si) {
  const ex = S.active.exercises[ei];
  const working = ex.sets.filter((s) => s.type !== 'warmup').length;
  const num = ex.sets.slice(0, si + 1).filter((s) => s.type !== 'warmup').length;
  return ex.sets[si].type === 'warmup' ? `Warm-up set · ${ex.name}` : `Set ${num} of ${working} · ${ex.name}`;
}

function completeSet(ei, si) {
  unlockAudio();
  const ex = S.active.exercises[ei], s = ex.sets[si];
  if (s.done) { s.done = false; save('active'); render(); return; }
  const rIn = document.querySelector(`input[data-f="r"][data-ei="${ei}"][data-si="${si}"]`);
  const wIn = document.querySelector(`input[data-f="w"][data-ei="${ei}"][data-si="${si}"]`);
  if (wIn) s.weight = wIn.value.trim();
  if (rIn) s.reps = rIn.value.trim();
  if (!toNum(s.reps)) { toast('Enter your reps first'); rIn?.focus(); return; }
  s.done = true;
  save('active');
  const nx = nextUp(ei, si);
  if (nx) {
    const newEx = nx.ei !== ei;
    const rest = (newEx ? S.active.exercises[nx.ei].rest : ex.rest) || S.settings.restSec;
    startTimer(rest, { ...nx, newEx, label: newEx ? `Next exercise: ${S.active.exercises[nx.ei].name}` : setLabel(nx.ei, nx.si) });
  } else {
    S.timer = null; save('timer');
    toast('All sets done — tap Finish when ready 💪', 4000);
  }
  render();
}

function finishWorkout() {
  const a = S.active;
  const exercises = a.exercises
    .map((e) => ({ name: e.name, sets: e.sets.filter((s) => s.done).map((s) => ({ weight: toNum(s.weight), reps: Math.round(toNum(s.reps)), type: s.type, done: true })) }))
    .filter((e) => e.sets.length);
  if (!exercises.length && !confirm('No sets completed. Discard this workout?')) return;
  if (!exercises.length) { discardWorkout(true); return; }
  const minutes = Math.max(1, Math.round((Date.now() - new Date(a.startedAt)) / 60000));
  const entry = { id: a.id, routineId: a.routineId, name: a.name, date: a.startedAt, durationMin: minutes, exercises };

  const prs = [];
  for (const e of exercises) {
    const prev = Math.max(0, ...exerciseHistory(S.history, e.name).flatMap((h) => h.sets.map((s) => e1rm(s.weight, s.reps))));
    const best = workingSets(e).reduce((b, s) => (e1rm(s.weight, s.reps) > e1rm(b?.weight, b?.reps) ? s : b), null);
    if (best && prev > 0 && e1rm(best.weight, best.reps) > prev) prs.push({ name: e.name, set: setStr(best) });
  }
  S.history.push(entry);
  S.history.sort((x, y) => x.date.localeCompare(y.date));
  const ups = a.exercises.map((e) => ({ name: e.name, ...progressionAdvice(S.history, { name: e.name, sets: e.sets.filter((s) => s.type !== 'warmup').length, repMin: e.repMin, repMax: e.repMax }, U()) }))
    .filter((x) => x.status === 'up');
  const r = routineById(a.routineId);
  const changed = r && (r.exercises.length !== a.exercises.length || r.exercises.some((e, i) => norm(e.name) !== norm(a.exercises[i]?.name)));
  const summary = {
    name: a.name, minutes, prs, ups, changed, routineName: r?.name, routineId: r?.id, activeExercises: a.exercises,
    sets: exercises.reduce((n, e) => n + workingSets(e).length, 0),
    volume: exercises.reduce((v, e) => v + workingSets(e).reduce((x, s) => x + s.weight * s.reps, 0), 0),
  };
  S.active = null; S.timer = null;
  save('history', 'active', 'timer');
  releaseAwake();
  go('today');
  openSheet({ type: 'summary', data: summary });
}

function discardWorkout(force) {
  if (!force && !confirm('Discard this workout? Nothing will be saved.')) return;
  S.active = null; S.timer = null;
  save('active', 'timer');
  releaseAwake();
  go('today');
}

// ---------- Rest timer & alerts ----------
function startTimer(sec, next) {
  S.timer = { endsAt: Date.now() + sec * 1000, total: sec * 1000, next, fired: false };
  save('timer');
  renderTimer();
}

// The bar's markup is rebuilt only when its mode/label changes; ticks just
// update the clock and progress so buttons stay tappable.
let timerKey = '';
function renderTimer() {
  const el = $('#timer');
  const t = S.timer;
  if (!t || !S.active) { el.classList.add('hidden'); el.classList.remove('go'); timerKey = ''; return; }
  el.classList.remove('hidden');
  const left = t.endsAt - Date.now();
  const mode = left <= 0 ? 'go' : 'run';
  const key = mode + '|' + t.next.label + '|' + t.endsAt;
  if (key !== timerKey) {
    timerKey = key;
    el.classList.toggle('go', mode === 'go');
    el.innerHTML = mode === 'go'
      ? `<div class="inner" data-a="tGoto"><div class="clock">GO</div><div class="lbl">${t.next.newEx ? 'New exercise' : 'Rest over'}<b>${esc(t.next.label)}</b></div>
        <button class="sm" data-a="tGoto">Show</button></div>`
      : `<div class="bar"><i></i></div><div class="inner"><div class="clock"></div>
        <div class="lbl">Up next<b>${esc(t.next.label)}</b></div>
        <button class="sm" data-a="tAdd" data-s="-15">−15</button><button class="sm" data-a="tAdd" data-s="15">+15</button><button class="sm" data-a="tSkip">Skip</button></div>`;
  }
  if (mode === 'run') {
    el.querySelector('.clock').textContent = mmss(left);
    el.querySelector('.bar i').style.width = Math.min(100, 100 * (1 - left / t.total)) + '%';
  }
}

function tick() {
  const t = S.timer;
  if (t && S.active && !t.fired && Date.now() >= t.endsAt) {
    t.fired = true;
    save('timer');
    alarm(t.next.newEx ? 'Time for the next exercise' : 'Time for your next set', t.next.label);
  }
  if (t && S.active) renderTimer();
  if (view === 'workout') {
    const e = $('#elapsed'), p = $('#proj');
    if (e) e.textContent = elapsedStr();
    if (p) p.textContent = projStr();
  }
}
setInterval(tick, 500);

let actx = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { /* no audio */ }
}
document.addEventListener('pointerdown', unlockAudio, { once: true });

function beep() {
  if (!actx) return;
  const t0 = actx.currentTime;
  [0, 0.25, 0.5, 0.9].forEach((dt, i) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = 'sine';
    o.frequency.value = i === 3 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + (i === 3 ? 0.45 : 0.18));
    o.connect(g).connect(actx.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.5);
  });
}

async function alarm(title, body) {
  if (S.settings.sound) beep();
  if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([300, 120, 300, 120, 600]);
  if ('Notification' in window && Notification.permission === 'granted') {
    const opts = { body, tag: 'rest-timer', renotify: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', vibrate: [300, 120, 300, 120, 600] };
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(title, opts);
      else new Notification(title, opts);
    } catch {
      try { new Notification(title, opts); } catch { /* unsupported */ }
    }
  }
}

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

// ---------- Import ----------
async function handleCSV(file) {
  try {
    const text = await file.text();
    const workouts = parseHevyCSV(text, U());
    if (!workouts.length) throw new Error('No workouts found in that file.');
    const candidates = routinesFromHistory(workouts);
    let pre = candidates.filter((c) => c.timesDone >= 2).slice(0, 8);
    if (!pre.length) pre = candidates.slice(0, 4);
    importState = { workouts, candidates, selected: new Set(pre.map((c) => c.id)), withHistory: true };
    render();
  } catch (e) {
    toast(e.message || 'Could not read that file.', 5000);
  }
}

function addRoutines(list) {
  for (const r of list) {
    const clean = { id: uid(), name: r.name, exercises: r.exercises.map((e) => ({ ...e })) };
    let name = clean.name, i = 2;
    while (S.routines.some((x) => x.name === name)) name = `${clean.name} (${i++})`;
    clean.name = name;
    S.routines.push(clean);
  }
  save('routines');
}

function doImport() {
  const { workouts, candidates, selected, withHistory } = importState;
  let added = 0;
  if (withHistory) {
    const m = mergeHistory(S.history, workouts);
    S.history = m.history; added = m.added;
    save('history');
  }
  const chosen = candidates.filter((c) => selected.has(c.id));
  addRoutines(chosen);
  importState = null;
  toast(`Imported ${chosen.length} routine${chosen.length === 1 ? '' : 's'}${withHistory ? ` and ${added} workouts` : ''}. Set your weekly schedule below.`, 5000);
  go('plan');
}

async function hevyApiImport() {
  const key = $('#apikey')?.value.trim();
  const msg = $('#apiMsg');
  if (!key) { toast('Paste your Hevy API key first'); return; }
  const get = async (path) => {
    const res = await fetch(`https://api.hevyapp.com/v1/${path}`, { headers: { 'api-key': key, accept: 'application/json' } });
    if (!res.ok) throw new Error(res.status === 401 ? 'Hevy rejected the API key.' : `Hevy returned ${res.status}.`);
    return res.json();
  };
  try {
    msg.textContent = 'Fetching routines…';
    const routines = [];
    for (let page = 1, pages = 1; page <= pages && page <= 20; page++) {
      const d = await get(`routines?page=${page}&pageSize=10`);
      pages = d.page_count || 1;
      routines.push(...(d.routines || []).map(hevyApiRoutine));
    }
    let added = 0;
    if ($('#apiHist')?.checked) {
      const ws = [];
      for (let page = 1, pages = 1; page <= pages && page <= 100; page++) {
        msg.textContent = `Fetching workouts (page ${page}${pages > 1 ? ' of ' + pages : ''})…`;
        const d = await get(`workouts?page=${page}&pageSize=10`);
        pages = d.page_count || 1;
        ws.push(...(d.workouts || []).map((w) => hevyApiWorkout(w, U())));
      }
      const m = mergeHistory(S.history, ws);
      S.history = m.history; added = m.added;
      save('history');
    }
    addRoutines(routines);
    toast(`Imported ${routines.length} routines${added ? ` and ${added} workouts` : ''}.`, 5000);
    go('plan');
  } catch (e) {
    msg.textContent = (e instanceof TypeError)
      ? "Couldn't reach Hevy from the browser (it may block direct access). Use the CSV export above instead — it includes everything."
      : e.message;
  }
}

// ---------- Event wiring ----------
const A = {
  tab: (el) => go(el.dataset.tab === 'today' && S.active ? 'workout' : el.dataset.tab),
  resume: () => go('workout'),
  start: (el) => startWorkout(routineById(el.dataset.id)),
  startEmpty: () => startWorkout(null),
  goImport: () => go('import'),
  programs: () => openSheet({ type: 'programs' }),
  closeSheet: () => closeSheet(),
  noop: () => {},
  setDone: (el) => completeSet(+el.dataset.ei, +el.dataset.si),
  cycleType: (el) => {
    const s = S.active.exercises[+el.dataset.ei].sets[+el.dataset.si];
    s.type = s.type === 'warmup' ? 'normal' : 'warmup';
    save('active'); render();
  },
  addSet: (el) => {
    const ex = S.active.exercises[+el.dataset.ei];
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push({ weight: last?.weight ?? '', reps: '', done: false, type: 'normal' });
    save('active'); render();
  },
  removeSet: (el) => {
    const ex = S.active.exercises[+el.dataset.ei];
    const i = ex.sets.map((s) => s.done).lastIndexOf(false);
    if (ex.sets.length <= 1) return toast('Use ⋯ → Remove to drop the exercise');
    ex.sets.splice(i >= 0 ? i : ex.sets.length - 1, 1);
    save('active'); render();
  },
  applyW: (el) => {
    const ex = S.active.exercises[+el.dataset.ei];
    ex.sets.forEach((s) => { if (!s.done && s.type !== 'warmup') s.weight = el.dataset.w; });
    save('active'); render();
  },
  exMenu: (el) => openSheet({ type: 'exMenu', ei: +el.dataset.ei }),
  moveActive: (el) => {
    const i = sheet.ei, j = i + +el.dataset.d, xs = S.active.exercises;
    if (j < 0 || j >= xs.length) return;
    [xs[i], xs[j]] = [xs[j], xs[i]];
    save('active'); closeSheet(); render();
  },
  rmActiveEx: () => {
    S.active.exercises.splice(sheet.ei, 1);
    save('active'); closeSheet(); render();
  },
  finish: () => finishWorkout(),
  discard: () => discardWorkout(),
  tAdd: (el) => {
    if (!S.timer) return;
    S.timer.endsAt += +el.dataset.s * 1000;
    S.timer.total = Math.max(1000, S.timer.total + +el.dataset.s * 1000);
    save('timer'); renderTimer();
  },
  tSkip: () => { S.timer = null; save('timer'); renderTimer(); },
  tGoto: () => {
    const n = S.timer?.next;
    S.timer = null; save('timer');
    if (view !== 'workout') go('workout');
    renderTimer();
    if (n) document.getElementById(`set-${n.ei}-${n.si}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  },
  swap: (el) => openSheet({ type: 'swap', ctx: el.dataset.ctx, ei: +el.dataset.ei, name: el.dataset.name, equip: [] }),
  eqFilter: (el) => {
    const q = el.dataset.q, eq = sheet.equip || [];
    sheet.equip = eq.includes(q) ? eq.filter((x) => x !== q) : [...eq, q];
    renderSheet();
  },
  pickSwap: (el) => {
    const name = el.dataset.name;
    if (sheet.ctx === 'w') {
      const old = S.active.exercises[sheet.ei];
      const fresh = buildActiveEx({ name, sets: old.sets.length, repMin: old.repMin, repMax: old.repMax, rest: old.rest });
      fresh.sets = old.sets.map((s, i) => (s.done ? s : fresh.sets[i] || { ...fresh.sets[0] }));
      S.active.exercises[sheet.ei] = fresh;
      save('active');
    } else if (sheet.ctx === 'r') {
      routineById(param).exercises[sheet.ei].name = name;
      save('routines');
    }
    closeSheet(); render();
    toast(`Swapped to ${name}`);
  },
  addEx: (el) => openSheet({ type: 'add', ctx: el.dataset.ctx, q: '' }),
  pickAdd: (el) => {
    const name = el.dataset.name;
    const p = planFor(name);
    const e = { name, sets: 3, repMin: p.repMin, repMax: p.repMax };
    if (sheet.ctx === 'w') { S.active.exercises.push(buildActiveEx(e)); save('active'); }
    else { routineById(param).exercises.push(e); save('routines'); }
    closeSheet(); render();
  },
  newRoutine: () => {
    const r = { id: uid(), name: `Workout ${String.fromCharCode(65 + (S.routines.length % 26))}`, exercises: [] };
    S.routines.push(r); save('routines');
    go('edit', r.id);
  },
  editRoutine: (el) => go('edit', el.dataset.id),
  moveEx: (el) => {
    const xs = routineById(param).exercises, i = +el.dataset.ei, j = i + +el.dataset.d;
    [xs[i], xs[j]] = [xs[j], xs[i]];
    save('routines'); render();
  },
  rmRoutineEx: (el) => {
    routineById(param).exercises.splice(+el.dataset.ei, 1);
    save('routines'); render();
  },
  dupRoutine: () => {
    const r = routineById(param);
    const c = { ...structuredClone(r), id: uid(), name: r.name + ' (copy)' };
    S.routines.push(c); save('routines');
    go('edit', c.id);
  },
  delRoutine: () => {
    const r = routineById(param);
    if (!confirm(`Delete “${r.name}”? Your history is kept.`)) return;
    S.routines = S.routines.filter((x) => x !== r);
    for (const k of Object.keys(S.schedule)) if (S.schedule[k] === r.id) delete S.schedule[k];
    save('routines', 'schedule');
    go('plan');
  },
  setDays: (el) => { S.settings.daysPerWeek = +el.dataset.n; save('settings'); render(); },
  installProgram: (el) => {
    const p = PROGRAMS.find((x) => x.id === el.dataset.id);
    const hasSched = Object.keys(S.schedule).length;
    if (hasSched && !confirm('Replace your current weekly schedule with this program’s days?')) return;
    const before = S.routines.length;
    addRoutines(p.routines);
    const added = S.routines.slice(before);
    S.schedule = {};
    p.days.forEach((d, i) => { S.schedule[d] = added[i % added.length].id; });
    S.settings.daysPerWeek = p.days.length;
    save('schedule', 'settings');
    closeSheet();
    go('plan');
    toast(`${p.name} added and scheduled.`);
  },
  histTab: (el) => go('history', el.dataset.t),
  moreHist: () => { histLimit += 40; render(); },
  exercise: (el) => go('exercise', el.dataset.name),
  delHist: (el) => {
    if (!confirm('Delete this workout from history?')) return;
    S.history = S.history.filter((w) => w.id !== el.dataset.id);
    save('history'); render();
  },
  doImport: () => doImport(),
  hevyApi: () => hevyApiImport(),
  notifPerm: async () => {
    if (!('Notification' in window)) return toast('Notifications are not supported here. On iPhone, add the app to your Home Screen first.', 5000);
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Notifications enabled' : 'Notifications blocked — you can allow them in browser settings.');
    render();
  },
  testAlarm: () => {
    unlockAudio();
    toast('Alert fires in 5 seconds — try locking your screen or switching apps.');
    setTimeout(() => alarm('Rest is over', 'This is how the next-set alert looks.'), 5000);
  },
  exportData: () => {
    const data = JSON.stringify({ app: 'workout-planner', version: 1, exportedAt: new Date().toISOString(), settings: S.settings, routines: S.routines, history: S.history, schedule: S.schedule }, null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  clearAll: () => {
    if (!confirm('Erase ALL routines, history and settings on this device?')) return;
    Object.keys(localStorage).filter((k) => k.startsWith('wp.')).forEach((k) => localStorage.removeItem(k));
    location.reload();
  },
  saveToRoutine: () => {
    const d = sheet.data, r = routineById(d.routineId);
    if (r) {
      r.exercises = d.activeExercises.map((e) => ({ name: e.name, sets: e.sets.filter((s) => s.type !== 'warmup').length || 1, repMin: e.repMin, repMax: e.repMax, ...(e.rest ? { rest: e.rest } : {}), ...(e.notes ? { notes: e.notes } : {}) }));
      save('routines');
      toast('Routine updated');
    }
    closeSheet();
  },
};

document.addEventListener('click', (ev) => {
  const tabBtn = ev.target.closest('.tabs button');
  if (tabBtn) return A.tab(tabBtn);
  if (ev.target.id === 'sheet') return closeSheet();
  const el = ev.target.closest('[data-a]');
  if (el && A[el.dataset.a]) {
    ev.preventDefault();
    A[el.dataset.a](el, ev);
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target, f = el.dataset?.f;
  if (!f) return;
  if (f === 'q' && sheet) { sheet.q = el.value; renderSheetList(); return; }
  if ((f === 'w' || f === 'r') && S.active) {
    const s = S.active.exercises[+el.dataset.ei].sets[+el.dataset.si];
    s[f === 'w' ? 'weight' : 'reps'] = el.value.trim();
    save('active');
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target, f = el.dataset?.f;
  if (!f) return;
  if (f === 'w' && S.active) {
    // Carry a changed weight down to the remaining sets of that exercise.
    const ex = S.active.exercises[+el.dataset.ei], si = +el.dataset.si;
    const v = el.value.trim();
    ex.sets.forEach((s, i) => {
      if (i > si && !s.done && s.type === ex.sets[si].type) {
        s.weight = v;
        const inp = document.querySelector(`input[data-f="w"][data-ei="${el.dataset.ei}"][data-si="${i}"]`);
        if (inp) inp.value = v;
      }
    });
    save('active');
  } else if (f === 'sched') {
    if (el.value) S.schedule[el.dataset.dow] = el.value; else delete S.schedule[el.dataset.dow];
    save('schedule'); render();
  } else if (f === 'rname') {
    routineById(param).name = el.value.trim() || 'Untitled';
    save('routines');
  } else if (f === 're') {
    const e = routineById(param).exercises[+el.dataset.ei], k = el.dataset.k;
    const v = parseInt(el.value, 10);
    if (k === 'rest') { if (v > 0) e.rest = v; else delete e.rest; }
    else if (v > 0) e[k] = v;
    if (e.repMin > e.repMax) [e.repMin, e.repMax] = [e.repMax, e.repMin];
    save('routines');
    const r = routineById(param);
    const est = $('#est'); if (est) est.outerHTML = estPill(r);
    const sets = $('#sets'); if (sets) sets.textContent = totalSets(r);
  } else if (f === 'set') {
    const k = el.dataset.k;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'restSec' || k === 'targetMin') v = Math.max(1, parseInt(v, 10) || DEFAULT_SETTINGS[k]);
    if (k === 'unit' && v !== S.settings.unit && S.history.length) toast('Unit changed. Existing weights are not converted.', 4000);
    S.settings[k] = v;
    save('settings');
    if (k === 'keepAwake') v ? keepAwake() : releaseAwake();
  } else if (f === 'csv' && el.files[0]) {
    handleCSV(el.files[0]);
  } else if (f === 'impHist' && importState) {
    importState.withHistory = el.checked;
  } else if (f === 'impSel' && importState) {
    el.checked ? importState.selected.add(el.dataset.id) : importState.selected.delete(el.dataset.id);
  } else if (f === 'restore' && el.files[0]) {
    el.files[0].text().then((t) => {
      const d = JSON.parse(t);
      if (d.app !== 'workout-planner') throw new Error();
      if (!confirm('Replace all current data with this backup?')) return;
      S.settings = { ...DEFAULT_SETTINGS, ...d.settings }; S.routines = d.routines || []; S.history = d.history || []; S.schedule = d.schedule || {};
      save('settings', 'routines', 'history', 'schedule');
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
