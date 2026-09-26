// Couch to 5K program + the rules that adapt it to how each run felt. Pure (no DOM) and tested.

export const WARMUP_SEC = 300;
export const COOLDOWN_SEC = 300;
export const RUNS_PER_WEEK = 3;
const DAY = 86400000;

const R = (sec) => ({ type: 'run', sec });
const W = (sec) => ({ type: 'walk', sec });
const reps = (n, ...segs) => Array.from({ length: n }, () => segs).flat();

// Classic 9-week plan. One entry per week: a single list (all three runs the same) or one list per run.
const WEEKS = [
  [reps(8, R(60), W(90))],
  [reps(6, R(90), W(120))],
  [reps(2, R(90), W(90), R(180), W(180))],
  [[R(180), W(90), R(300), W(150), R(180), W(90), R(300)]],
  [[R(300), W(180), R(300), W(180), R(300)], [R(480), W(300), R(480)], [R(1200)]],
  [[R(300), W(180), R(480), W(180), R(300)], [R(600), W(180), R(600)], [R(1320)]],
  [[R(1500)]],
  [[R(1680)]],
  [[R(1800)]],
];

export const PLAN = WEEKS.flatMap((days, w) =>
  Array.from({ length: RUNS_PER_WEEK }, (_, d) => ({ week: w + 1, day: d + 1, main: days[d] || days[0] })));
export const TOTAL = PLAN.length;
export const WEEK_COUNT = WEEKS.length;

export const weekStart = (pos) => pos - (pos % RUNS_PER_WEEK);
export const withWarmup = (main) => [{ type: 'warmup', sec: WARMUP_SEC }, ...main, { type: 'cooldown', sec: COOLDOWN_SEC }];

export const mmss = (sec) => {
  const t = Math.max(0, Math.ceil(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export function totals(segs) {
  const out = { total: 0, run: 0, walk: 0 };
  for (const s of segs) {
    out.total += s.sec;
    if (s.type === 'run') out.run += s.sec; else out.walk += s.sec;
  }
  return out;
}

// "8 × (Run 1:00, Walk 1:30)", "Run 20:00 non-stop", or the intervals in order.
export function describe(main) {
  const name = (s) => `${s.type === 'run' ? 'Run' : 'Walk'} ${mmss(s.sec)}`;
  if (main.length === 1) return `${name(main[0])} non-stop`;
  for (let p = 1; p <= main.length / 2; p++) {
    if (main.length % p) continue;
    if (main.every((s, i) => s.type === main[i % p].type && s.sec === main[i % p].sec)) {
      return `${main.length / p} × (${main.slice(0, p).map(name).join(', ')})`;
    }
  }
  return main.map(name).join(' · ');
}

// A gentler version of a run: walk breaks 30 s longer; a long non-stop run gets a 90 s walk halfway.
export function ease(main) {
  if (main.some((s) => s.type === 'walk')) return main.map((s) => (s.type === 'walk' ? W(s.sec + 30) : { ...s }));
  return main.flatMap((s) => {
    if (s.type !== 'run' || s.sec < 600) return [{ ...s }];
    const a = Math.round(s.sec / 120) * 60;
    return [R(a), W(90), R(s.sec - a)];
  });
}

// Where the clock is inside a list of segments.
export function locate(segs, elapsedSec) {
  let t = 0;
  for (let i = 0; i < segs.length; i++) {
    if (elapsedSec < t + segs[i].sec) return { idx: i, into: elapsedSec - t, left: t + segs[i].sec - elapsedSec, start: t, done: false };
    t += segs[i].sec;
  }
  return { idx: segs.length - 1, into: segs.at(-1)?.sec || 0, left: 0, start: t - (segs.at(-1)?.sec || 0), done: true };
}

// "Run 3 of 8" numbering for each segment.
export function intervalNumbers(segs) {
  const count = { run: 0, walk: 0 };
  const totalOf = { run: segs.filter((s) => s.type === 'run').length, walk: segs.filter((s) => s.type === 'walk').length };
  return segs.map((s) => (s.type in count ? { n: ++count[s.type], of: totalOf[s.type] } : null));
}

export const newState = () => ({ pos: 0, ease: false, easeReason: '', nextRunFrom: null, log: [] });

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

// The next workout for this state, including a check for a long break since the last run.
export function nextWorkout(state, now = new Date()) {
  let pos = Math.min(state.pos, TOTAL);
  let eased = state.ease;
  const notes = [];
  if (state.ease && state.easeReason) notes.push(state.easeReason);

  const last = state.log.at(-1);
  const off = last ? daysBetween(new Date(last.date), now) : 0;
  if (pos < TOTAL && off >= 21 && pos > 0) {
    pos = Math.max(0, weekStart(pos) - RUNS_PER_WEEK);
    eased = false;
    notes.length = 0;
    notes.push(`It's been ${off} days since your last run, so you're stepping back a week to rebuild.`);
  } else if (pos < TOTAL && off >= 10 && !eased) {
    eased = true;
    notes.push(`It's been ${off} days since your last run, so walk breaks are a bit longer today.`);
  }

  if (pos >= TOTAL) return { graduated: true, pos, notes };
  const p = PLAN[pos];
  const main = eased ? ease(p.main) : p.main.map((s) => ({ ...s }));
  let restLeft = 0;
  if (state.nextRunFrom) restLeft = Math.max(0, daysBetween(now, new Date(state.nextRunFrom)));
  return { graduated: false, pos, week: p.week, day: p.day, eased, main, segments: withWarmup(main), notes, restLeft };
}

// Pain words in free-text notes, used to prompt the user to tick "Something hurts".
const PAIN = /\b(pain|painful|hurts?|hurting|injur\w*|sprain\w*|shin ?splints?|ache|aching|sore (knee|ankle|shin|hip|foot|calf)|twinge|limp\w*)\b/i;
const NEGATED = /\b(no|not|without|zero)\s+(any\s+)?(pain|hurt|injur\w*|aches?)\b/i;
export const painMentioned = (notes = '') => PAIN.test(notes) && !NEGATED.test(notes);

export const FEELINGS = {
  easy: { emoji: '😄', label: 'Easy', hint: 'I could have done more' },
  right: { emoji: '🙂', label: 'Just right', hint: 'Challenging but doable' },
  hard: { emoji: '😮‍💨', label: 'Hard', hint: 'Tough, but I finished' },
  failed: { emoji: '😣', label: "Couldn't finish", hint: 'Had to stop or skip intervals' },
};

const label = (pos) => (pos >= TOTAL ? 'the finish line' : `Week ${PLAN[pos].week}, Run ${PLAN[pos].day}`);

// Record a finished run and decide the next workout.
// fb: { pos, feeling: easy|right|hard|failed, pain, notes, completed, durationSec, runSec, eased, skippedRunSec }
export function applyFeedback(state, fb, now = new Date()) {
  const prev = state.log.at(-1);
  let pos = fb.pos, easeNext = false, easeReason = '', restDays = 1, kind, headline, detail;

  if (fb.pain) {
    kind = 'repeat'; easeNext = true; restDays = 3;
    easeReason = 'You reported pain last time, so walk breaks are longer.';
    headline = `Rest 2 days, then repeat ${label(pos)}`;
    detail = 'Take two full rest days. Next time the walk breaks are longer. If the pain is sharp, gets worse while you run, or lasts more than a few days, stop running and see a doctor or physio.';
  } else if (fb.feeling === 'failed') {
    if (prev && prev.pos === fb.pos && prev.feeling === 'failed' && weekStart(fb.pos) > 0) {
      kind = 'back'; pos = weekStart(fb.pos) - 1; restDays = 2;
      headline = `Step back to ${label(pos)}`;
      detail = "This run didn't work out twice, so you'll go back to the end of last week to build a stronger base. That's normal. Lots of people repeat weeks.";
    } else {
      kind = 'repeat'; easeNext = true;
      easeReason = "You couldn't finish this run last time, so walk breaks are longer.";
      headline = `Repeat ${label(pos)} with longer walk breaks`;
      detail = "No problem. You'll do this run again, a little gentler. Try slowing down: you should be able to talk in short sentences while you run.";
    }
  } else if (fb.feeling === 'hard') {
    if (prev && prev.feeling === 'hard' && !prev.pain) {
      kind = 'repeat'; easeNext = true;
      easeReason = 'Your last two runs felt hard, so walk breaks are longer.';
      headline = `Repeat ${label(pos)}, a little gentler`;
      detail = "Two hard runs in a row, so you'll repeat this one with longer walk breaks before moving on. Slow down if you need to. Pace doesn't matter yet.";
    } else {
      kind = 'advance'; pos += 1; easeNext = pos < TOTAL;
      easeReason = 'Your last run felt hard, so walk breaks are 30 s longer.';
      headline = `On to ${label(pos)}, a little gentler`;
      detail = 'Nice work finishing. The next run has longer walk breaks. If it feels right you go back to the normal plan after that.';
    }
  } else if (fb.feeling === 'easy') {
    pos += 1;
    const jump = prev && prev.feeling === 'easy' && !fb.eased && pos < TOTAL && pos % RUNS_PER_WEEK !== 0;
    if (jump) {
      kind = 'jump'; pos = weekStart(pos) + RUNS_PER_WEEK;
      headline = `Skipping ahead to ${label(pos)}`;
      detail = "Two easy runs in a row, so you'll skip the rest of this week. If the new week feels too hard, say so and the plan will ease off.";
    } else {
      kind = 'advance';
      headline = `On to ${label(pos)}`;
      detail = 'Great run. If the next one feels easy too, you\'ll skip ahead to the next week.';
    }
  } else {
    kind = 'advance'; pos += 1;
    headline = `On to ${label(pos)}`;
    detail = 'Right on track. Keep the same easy pace.';
  }

  pos = Math.min(pos, TOTAL);
  if (pos >= TOTAL) {
    kind = 'finish'; easeNext = false; easeReason = '';
    headline = 'You finished Couch to 5K!';
    detail = "That's 30 minutes of non-stop running. Keep running 3 times a week to hold on to it.";
  }

  const next = new Date(now); next.setDate(next.getDate() + restDays); next.setHours(0, 0, 0, 0);
  const change = { kind, headline, detail };
  const entry = {
    id: now.getTime().toString(36), date: now.toISOString(), pos: fb.pos, week: PLAN[fb.pos].week, day: PLAN[fb.pos].day,
    feeling: fb.feeling, pain: !!fb.pain, notes: (fb.notes || '').trim(), completed: !!fb.completed,
    durationSec: Math.round(fb.durationSec || 0), runSec: Math.round(fb.runSec || 0), eased: !!fb.eased, skippedRunSec: Math.round(fb.skippedRunSec || 0), change,
  };
  return {
    state: { ...state, pos, ease: easeNext, easeReason: easeNext ? easeReason : '', nextRunFrom: next.toISOString(), log: [...state.log, entry] },
    change,
  };
}

// Jump to any run in the plan (e.g. you already run a bit and want to start at week 3).
export const setPosition = (state, pos) => ({ ...state, pos: Math.max(0, Math.min(TOTAL, pos)), ease: false, easeReason: '', nextRunFrom: null });
