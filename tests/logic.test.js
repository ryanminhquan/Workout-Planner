import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseCSV, parseHevyDate, parseHevyCSV, routinesFromHistory, progressionAdvice, estimateMinutes,
  maxSetsFor, mergeHistory, suggestNext, hevyApiRoutine, deriveRepRange, warmupPlan, warmupCount,
} from '../js/logic.js';
import { alternativesFor, guessPattern } from '../js/exercises.js';
import { PROGRAMS } from '../js/programs.js';

const csv = readFileSync(new URL('./fixtures-hevy.csv', import.meta.url), 'utf8');

test('parseCSV handles quotes, commas and CRLF', () => {
  assert.deepEqual(parseCSV('a,"b,c","d ""q"""\r\n1,2,3\r\n'), [['a', 'b,c', 'd "q"'], ['1', '2', '3']]);
});

test('parseHevyDate handles Hevy export and ISO formats', () => {
  const d = parseHevyDate('2 Sep 2026, 18:00');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8);
  assert.equal(d.getDate(), 2);
  assert.equal(d.getHours(), 18);
  assert.ok(parseHevyDate('2026-09-02T18:00:00Z') instanceof Date);
  assert.equal(parseHevyDate(''), null);
});

test('parseHevyCSV groups rows into workouts', () => {
  const ws = parseHevyCSV(csv, 'lb');
  assert.equal(ws.length, 3);
  const [push1, legs, push2] = ws;
  assert.equal(push1.name, 'Push');
  assert.equal(legs.name, 'Legs, Heavy');
  assert.equal(push1.durationMin, 47);
  assert.equal(push1.exercises.length, 2);
  assert.equal(push1.exercises[0].sets.length, 4);
  assert.equal(push1.exercises[0].sets[0].type, 'warmup');
  assert.equal(push1.exercises[0].notes, 'Pause at chest');
  assert.equal(push2.exercises[0].sets[0].weight, 135);
  assert.equal(legs.exercises[1].sets[0].secs, 60);
});

test('parseHevyCSV converts lb to kg', () => {
  const ws = parseHevyCSV(csv, 'kg');
  assert.equal(ws[0].exercises[0].sets[1].weight, 61);
});

test('parseHevyCSV rejects non-Hevy files', () => {
  assert.throws(() => parseHevyCSV('foo,bar\n1,2\n'), /Hevy/);
});

test('routinesFromHistory builds routines from the latest session', () => {
  const rs = routinesFromHistory(parseHevyCSV(csv));
  assert.equal(rs[0].name, 'Push');
  assert.equal(rs[0].timesDone, 2);
  assert.equal(rs[0].exercises.length, 1); // latest Push only had bench
  assert.equal(rs[0].exercises[0].sets, 3);
  assert.equal(rs[0].exercises[0].warmup, undefined); // latest Push had no warm-up
  const legsR = rs.find((r) => r.name === 'Legs, Heavy');
  assert.equal(legsR.exercises[0].warmup, undefined);
  assert.deepEqual([rs[0].exercises[0].repMin, rs[0].exercises[0].repMax], [8, 12]);
  const legs = rs.find((r) => r.name === 'Legs, Heavy');
  assert.deepEqual([legs.exercises[0].repMin, legs.exercises[0].repMax], [5, 8]);
});

test('deriveRepRange', () => {
  assert.deepEqual(deriveRepRange(10), [8, 12]);
  assert.deepEqual(deriveRepRange(5), [5, 8]);
  assert.deepEqual(deriveRepRange(15), [15, 20]);
});

const hist = (...sessions) => sessions.map((sets, i) => ({
  id: String(i), name: 'W', date: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
  exercises: [{ name: 'Bench Press (Barbell)', sets: sets.map(([weight, reps]) => ({ weight, reps, done: true, type: 'normal' })) }],
}));
const bench = { name: 'Bench Press (Barbell)', sets: 3, repMin: 8, repMax: 12 };

test('progression: move up when every set hits the top of the range', () => {
  const a = progressionAdvice(hist([[135, 12], [135, 12], [135, 12]]), bench, 'lb');
  assert.equal(a.status, 'up');
  assert.equal(a.suggestedWeight, 140);
  const squat = progressionAdvice([{ date: '2026-09-01', name: 'L', exercises: [{ name: 'Squat (Barbell)', sets: [[185, 8], [185, 8], [185, 8]].map(([weight, reps]) => ({ weight, reps })) }] }],
    { name: 'Squat (Barbell)', sets: 3, repMin: 5, repMax: 8 }, 'lb');
  assert.equal(squat.suggestedWeight, 195);
  assert.equal(progressionAdvice(hist([[60, 12], [60, 12], [60, 12]]), bench, 'kg').suggestedWeight, 62.5);
});

test('progression: hold when not all sets hit the top', () => {
  const a = progressionAdvice(hist([[135, 12], [135, 11], [135, 10]]), bench);
  assert.equal(a.status, 'hold');
  assert.equal(a.suggestedWeight, 135);
});

test('progression: hold when fewer sets than planned', () => {
  assert.equal(progressionAdvice(hist([[135, 12], [135, 12]]), bench).status, 'hold');
});

test('progression: stalled after 3 sessions without gains', () => {
  const a = progressionAdvice(hist([[135, 10], [135, 9], [135, 8]], [[135, 10], [135, 9], [135, 8]], [[135, 9], [135, 9], [135, 8]]), bench);
  assert.equal(a.status, 'stalled');
  assert.equal(a.suggestedWeight, 120);
});

test('progression: new exercise', () => {
  assert.equal(progressionAdvice([], bench).status, 'new');
});

test('time estimates keep starter programs near 45 minutes', () => {
  assert.equal(maxSetsFor(45, 180), 11);
  for (const p of PROGRAMS) {
    for (const r of p.routines) {
      const m = estimateMinutes(r, 180);
      assert.ok(m >= 40 && m <= 50, `${r.name} is ${m} min`);
    }
  }
});

test('mergeHistory skips duplicates', () => {
  const ws = parseHevyCSV(csv);
  const first = mergeHistory([], ws);
  assert.equal(first.added, 3);
  const again = mergeHistory(first.history, parseHevyCSV(csv));
  assert.equal(again.added, 0);
});

test('suggestNext prefers schedule, then least recent', () => {
  const rs = [{ id: 'a', name: 'A', exercises: [] }, { id: 'b', name: 'B', exercises: [] }];
  const monday = new Date('2026-09-21T12:00:00');
  assert.equal(suggestNext(rs, [], { 1: 'b' }, monday).routine.id, 'b');
  const h = [{ name: 'B', date: '2026-09-10T00:00:00Z', exercises: [] }, { name: 'A', date: '2026-09-12T00:00:00Z', exercises: [] }];
  assert.equal(suggestNext(rs, h, {}, monday).routine.id, 'b');
});

test('hevyApiRoutine maps rep ranges', () => {
  const r = hevyApiRoutine({ title: 'Upper', exercises: [{ title: 'Pull Up', rest_seconds: 120, sets: [{ type: 'warmup', reps: 5 }, { type: 'normal', rep_range: { start: 6, end: 10 } }, { type: 'normal', rep_range: { start: 6, end: 10 } }] }] });
  assert.deepEqual(r.exercises[0], { name: 'Pull Up', sets: 2, repMin: 6, repMax: 10, rest: 120, warmup: { sets: 1 } });
});

test('alternatives: same movement pattern, filterable by equipment', () => {
  const { pattern, items } = alternativesFor('Bench Press (Barbell)');
  assert.equal(pattern, 'chest_press');
  assert.ok(items.some((i) => i.name === 'Bench Press (Dumbbell)'));
  assert.ok(!items.some((i) => i.name === 'Bench Press (Barbell)'));
  const db = alternativesFor('Bench Press (Barbell)', ['Dumbbell']).items;
  assert.ok(db.length && db.every((i) => i.equip === 'Dumbbell'));
  assert.equal(guessPattern('Seated Hamstring Curl'), 'ham_iso');
  assert.equal(guessPattern('Some Custom Row Thing'), 'row');
  assert.equal(guessPattern('Zzz'), null);
});

test('warmupPlan ramps toward the working weight', () => {
  assert.deepEqual(warmupPlan(2, 135, 'lb'), [{ pct: 50, weight: 70, reps: 8 }, { pct: 75, weight: 100, reps: 4 }]);
  assert.deepEqual(warmupPlan(3, 100, 'kg').map((p) => p.weight), [40, 60, 80]);
  assert.deepEqual(warmupPlan(1, 0).map((p) => p.weight), [0]); // no working weight yet
  assert.deepEqual(warmupPlan(0, 135), []);
  assert.equal(warmupCount({ warmup: { sets: 9 } }), 3);
  assert.equal(warmupCount({}), 0);
});

test('warm-up sets add time with their own shorter rest', () => {
  const r = { exercises: [{ name: 'Squat (Barbell)', sets: 3, repMin: 5, repMax: 8 }] };
  const base = estimateMinutes(r, 180, 60);
  const withWu = estimateMinutes({ exercises: [{ ...r.exercises[0], warmup: { sets: 2 } }] }, 180, 60);
  assert.equal(withWu - base, Math.round(2 * 0.75 + 2 * 1)); // 2 sets + 2 × 60s rest
});

test('Hevy CSV warm-ups carry into routines', () => {
  const ws = parseHevyCSV(csv);
  const onlyFirst = routinesFromHistory([ws[0]]);
  assert.deepEqual(onlyFirst[0].exercises[0].warmup, { sets: 1 });
});
