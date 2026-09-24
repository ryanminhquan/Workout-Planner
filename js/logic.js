// Pure logic (no DOM) — CSV/Hevy import, progression advice, time estimates.
import { norm, isLowerBodyCompound, guessPattern } from './exercises.js';

export const DEFAULT_SETTINGS = {
  restSec: 180,
  unit: 'lb',
  daysPerWeek: 3,
  targetMin: 45,
  sound: true,
  vibrate: true,
  keepAwake: true,
};

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const roundTo = (x, step) => Math.round(x / step) * step;
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// ---------- CSV ----------

export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = String(text).replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Hevy exports dates like "10 Jan 2024, 18:30"; the API uses ISO strings.
export function parseHevyDate(s) {
  if (!s) return null;
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5]);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

const KG_PER_LB = 0.45359237;
function convertWeight(w, from, to) {
  if (!w) return 0;
  if (from === to) return w;
  return roundTo(from === 'kg' ? w / KG_PER_LB : w * KG_PER_LB, 0.5);
}

// Parse Hevy "Export Workouts" CSV into history entries (in the user's unit).
export function parseHevyCSV(text, unit = 'lb') {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('The file looks empty.');
  const h = rows[0].map((x) => x.trim().toLowerCase());
  const col = (name) => h.indexOf(name);
  const iTitle = col('title'), iStart = col('start_time'), iEnd = col('end_time');
  const iEx = col('exercise_title'), iType = col('set_type'), iReps = col('reps');
  const iNotes = col('exercise_notes'), iDur = col('duration_seconds');
  let iW = col('weight_lbs'), from = 'lb';
  if (iW < 0) { iW = col('weight_kg'); from = 'kg'; }
  if (iW < 0) { iW = col('weight'); from = unit; }
  if (iTitle < 0 || iStart < 0 || iEx < 0 || iReps < 0) {
    throw new Error("This doesn't look like a Hevy workout export (missing title/start_time/exercise_title/reps columns).");
  }
  const byKey = new Map();
  for (const r of rows.slice(1)) {
    if (!r[iEx]) continue;
    const key = r[iTitle] + '|' + r[iStart];
    let w = byKey.get(key);
    if (!w) {
      const start = parseHevyDate(r[iStart]);
      const end = iEnd >= 0 ? parseHevyDate(r[iEnd]) : null;
      w = {
        id: uid(),
        name: r[iTitle] || 'Workout',
        date: (start || new Date()).toISOString(),
        durationMin: start && end ? Math.max(0, Math.round((end - start) / 60000)) : null,
        exercises: [],
        source: 'hevy',
      };
      byKey.set(key, w);
    }
    let ex = w.exercises.find((e) => e.name === r[iEx]);
    if (!ex) {
      ex = { name: r[iEx], sets: [] };
      if (iNotes >= 0 && r[iNotes]) ex.notes = r[iNotes];
      w.exercises.push(ex);
    }
    const set = {
      weight: convertWeight(num(r[iW]), from, unit),
      reps: Math.round(num(r[iReps])),
      type: (iType >= 0 && r[iType]) || 'normal',
      done: true,
    };
    if (iDur >= 0 && num(r[iDur])) set.secs = num(r[iDur]);
    ex.sets.push(set);
  }
  return [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Target rep range from the reps someone typically does.
export function deriveRepRange(reps) {
  const r = Math.round(reps) || 10;
  if (r >= 8 && r <= 12) return [8, 12];
  if (r < 8) return [Math.max(1, r), r + 3];
  return [r, r + 5];
}

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// Candidate routines: one per distinct workout title, built from the most
// recent session with that title.
export function routinesFromHistory(workouts) {
  const groups = new Map();
  for (const w of workouts) {
    const g = groups.get(w.name) || { count: 0, last: null };
    g.count++;
    if (!g.last || w.date > g.last.date) g.last = w;
    groups.set(w.name, g);
  }
  return [...groups.entries()]
    .map(([name, g]) => ({
      id: uid(),
      name,
      timesDone: g.count,
      lastDone: g.last.date,
      exercises: g.last.exercises.map((e) => {
        const ws = e.sets.filter((s) => s.type !== 'warmup');
        const [repMin, repMax] = deriveRepRange(median(ws.map((s) => s.reps)));
        return { name: e.name, sets: Math.max(1, ws.length), repMin, repMax };
      }),
    }))
    .sort((a, b) => b.timesDone - a.timesDone || b.lastDone.localeCompare(a.lastDone));
}

// Hevy public API (Pro) shapes -> ours
export function hevyApiRoutine(r) {
  return {
    id: uid(),
    name: r.title || 'Routine',
    exercises: (r.exercises || []).map((e) => {
      const ws = (e.sets || []).filter((s) => s.type !== 'warmup');
      const rr = ws.find((s) => s.rep_range)?.rep_range;
      const [repMin, repMax] = rr && rr.start ? [rr.start, rr.end || rr.start] : deriveRepRange(median(ws.map((s) => s.reps || 0)));
      const ex = { name: e.title, sets: Math.max(1, ws.length), repMin, repMax };
      if (e.rest_seconds) ex.rest = e.rest_seconds;
      if (e.notes) ex.notes = e.notes;
      return ex;
    }),
  };
}

export function hevyApiWorkout(w, unit = 'lb') {
  const start = parseHevyDate(w.start_time);
  const end = parseHevyDate(w.end_time);
  return {
    id: uid(),
    name: w.title || 'Workout',
    date: (start || new Date()).toISOString(),
    durationMin: start && end ? Math.round((end - start) / 60000) : null,
    source: 'hevy',
    exercises: (w.exercises || []).map((e) => ({
      name: e.title,
      sets: (e.sets || []).map((s) => ({
        weight: convertWeight(num(s.weight_kg), 'kg', unit),
        reps: Math.round(num(s.reps)),
        type: s.type || 'normal',
        done: true,
      })),
    })),
  };
}

// Merge imported workouts, skipping ones already present (same name + minute).
export function mergeHistory(existing, incoming) {
  const key = (w) => w.name + '|' + w.date.slice(0, 16);
  const seen = new Set(existing.map(key));
  const added = incoming.filter((w) => !seen.has(key(w)));
  return { history: [...existing, ...added].sort((a, b) => a.date.localeCompare(b.date)), added: added.length };
}

// ---------- Progress ----------

export const workingSets = (ex) =>
  (ex?.sets || []).filter((s) => s.done !== false && s.type !== 'warmup' && s.reps > 0);

export const e1rm = (w, r) => (w > 0 && r > 0 ? w * (1 + r / 30) : 0);

// Sessions containing this exercise, newest first: [{date, sets}]
export function exerciseHistory(history, name) {
  const k = norm(name);
  const out = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const w = history[i];
    const ex = w.exercises.find((e) => norm(e.name) === k);
    if (ex && workingSets(ex).length) out.push({ date: w.date, workout: w.name, sets: workingSets(ex) });
  }
  return out;
}

export function increment(name, unit) {
  const lower = isLowerBodyCompound(name);
  if (unit === 'kg') return lower ? 5 : 2.5;
  return lower ? 10 : 5;
}

const fmtW = (w, unit) => (w ? `${+w.toFixed(1)} ${unit}` : 'bodyweight');
export const setStr = (s) => (s.weight ? `${+s.weight.toFixed(1)}×${s.reps}` : `${s.reps} reps`);

// Double progression: work in a rep range; once every target set hits the top
// of the range at the same weight, add weight.
export function progressionAdvice(history, ex, unit = 'lb') {
  const repMin = ex.repMin || 8, repMax = ex.repMax || 12, target = ex.sets || 3;
  const hist = exerciseHistory(history, ex.name);
  if (!hist.length) {
    return { status: 'new', message: `No history yet — pick a weight you could do for about ${repMax + 2} reps, then do ${repMin}–${repMax}.` };
  }
  const last = hist[0].sets;
  const top = Math.max(...last.map((s) => s.weight || 0));
  const atTop = last.filter((s) => (s.weight || 0) === top);
  const lastStr = last.map(setStr).join(', ');
  const base = { lastWeight: top, lastSets: last, lastDate: hist[0].date };
  const allHitTop = atTop.length >= target && atTop.every((s) => s.reps >= repMax);

  if (allHitTop) {
    if (!top) {
      return { ...base, status: 'up', message: `You hit ${repMax}+ reps on every set. Add weight (belt/vest/dumbbell) or move to a harder variation.` };
    }
    const next = top + increment(ex.name, unit);
    return { ...base, status: 'up', suggestedWeight: next, message: `Time to move up! Last time: ${lastStr}. Go to ${fmtW(next, unit)} and aim for ${repMin}+ reps.` };
  }

  // Stalled: same top weight 3 sessions running without more total reps.
  if (hist.length >= 3) {
    const recent = hist.slice(0, 3).map((h) => ({
      top: Math.max(...h.sets.map((s) => s.weight || 0)),
      reps: h.sets.reduce((a, s) => a + s.reps, 0),
    }));
    const sameWeight = recent.every((r) => r.top === recent[0].top);
    const noGain = recent[0].reps <= recent[1].reps && recent[1].reps <= recent[2].reps;
    if (sameWeight && noGain && last.some((s) => s.reps < repMax)) {
      const deload = top ? roundTo(top * 0.9, unit === 'kg' ? 2.5 : 5) : 0;
      return {
        ...base,
        status: 'stalled',
        suggestedWeight: deload || undefined,
        message: `Stuck for 3 sessions at ${fmtW(top, unit)}. Try ${deload ? fmtW(deload, unit) + ' (−10%) and build back up' : 'an easier variation for a week'}, check sleep/food, or swap for an alternative.`,
      };
    }
  }

  const low = last.some((s) => s.reps < repMin);
  return {
    ...base,
    status: 'hold',
    suggestedWeight: top || undefined,
    message: low
      ? `Last: ${lastStr}. Stay at ${fmtW(top, unit)} and work up to ${repMin}+ reps on every set.`
      : `Last: ${lastStr}. Stay at ${fmtW(top, unit)} — beat at least one set by a rep. Move up once all ${target} sets hit ${repMax}.`,
  };
}

// ---------- Time & planning ----------

export const WORK_MIN_PER_SET = 0.75;
export const WARMUP_MIN = 4;

export function estimateMinutes(routine, restSec = 180) {
  const exs = routine.exercises || [];
  const sets = exs.reduce((a, e) => a + (+e.sets || 0), 0);
  if (!sets) return 0;
  let rest = 0, remaining = sets;
  for (const e of exs) {
    for (let i = 0; i < (+e.sets || 0); i++) {
      remaining--;
      if (remaining > 0) rest += (e.rest || restSec) / 60;
    }
  }
  return Math.round(WARMUP_MIN + sets * WORK_MIN_PER_SET + rest);
}

export function maxSetsFor(targetMin, restSec = 180) {
  const r = restSec / 60;
  return Math.max(1, Math.floor((targetMin - WARMUP_MIN + r) / (WORK_MIN_PER_SET + r)));
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

export function workoutsThisWeek(history, now = new Date()) {
  const s = startOfWeek(now).toISOString();
  return history.filter((w) => w.date >= s);
}

// Which routine should be done next: today's scheduled one, else the routine
// done least recently.
export function suggestNext(routines, history, schedule = {}, now = new Date()) {
  if (!routines.length) return null;
  const today = schedule[now.getDay()];
  const scheduled = today && routines.find((r) => r.id === today);
  if (scheduled) return { routine: scheduled, reason: 'Scheduled for today' };
  const lastDone = (r) => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].routineId === r.id || norm(history[i].name) === norm(r.name)) return history[i].date;
    }
    return '';
  };
  const sorted = [...routines].sort((a, b) => lastDone(a).localeCompare(lastDone(b)));
  return { routine: sorted[0], reason: lastDone(sorted[0]) ? 'Done least recently' : 'Not done yet' };
}

// Muscle groups a routine hits (for display).
export function routineFocus(routine) {
  const groups = new Set();
  for (const e of routine.exercises || []) {
    const p = guessPattern(e.name);
    if (!p) continue;
    if (['chest_press', 'chest_iso'].includes(p)) groups.add('Chest');
    else if (['vert_push', 'side_delt', 'rear_delt'].includes(p)) groups.add('Shoulders');
    else if (['vert_pull', 'row'].includes(p)) groups.add('Back');
    else if (['squat', 'single_leg', 'quad_iso', 'hinge', 'glute', 'ham_iso', 'calves'].includes(p)) groups.add('Legs');
    else if (['biceps', 'triceps'].includes(p)) groups.add('Arms');
    else if (p === 'core') groups.add('Core');
  }
  return [...groups];
}
