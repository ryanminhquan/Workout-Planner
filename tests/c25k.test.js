import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN, TOTAL, WARMUP_SEC, COOLDOWN_SEC, totals, describe, ease, locate, intervalNumbers, newState,
  nextWorkout, applyFeedback, painMentioned, setPosition, withWarmup,
} from '../run/js/c25k.js';

const day = (n) => new Date(2026, 8, 1 + n, 18, 0, 0);
const run = (state, feeling, n, extra = {}) => applyFeedback(state, { pos: state.pos, feeling, completed: feeling !== 'failed', ...extra }, day(n)).state;

test('plan has 9 weeks × 3 runs and the classic structure', () => {
  assert.equal(TOTAL, 27);
  assert.equal(totals(PLAN[0].main).total, 20 * 60);
  assert.equal(totals(PLAN[0].main).run, 8 * 60);
  assert.deepEqual(PLAN[14].main, [{ type: 'run', sec: 1200 }]);
  assert.equal(PLAN[26].main[0].sec, 30 * 60);
  const full = withWarmup(PLAN[0].main);
  assert.equal(full[0].sec, WARMUP_SEC);
  assert.equal(full.at(-1).sec, COOLDOWN_SEC);
});

test('describe summarizes repeating and non-stop runs', () => {
  assert.equal(describe(PLAN[0].main), '8 × (Run 1:00, Walk 1:30)');
  assert.equal(describe(PLAN[6].main), '2 × (Run 1:30, Walk 1:30, Run 3:00, Walk 3:00)');
  assert.equal(describe(PLAN[26].main), 'Run 30:00 non-stop');
  assert.equal(describe(PLAN[13].main), 'Run 8:00 · Walk 5:00 · Run 8:00');
});

test('ease lengthens walks, or splits a long non-stop run', () => {
  assert.equal(ease(PLAN[0].main)[1].sec, 120);
  assert.equal(totals(ease(PLAN[0].main)).run, 8 * 60);
  const e = ease(PLAN[14].main);
  assert.deepEqual(e.map((s) => s.type), ['run', 'walk', 'run']);
  assert.equal(e[0].sec + e[2].sec, 1200);
});

test('locate finds the current interval', () => {
  const segs = withWarmup(PLAN[0].main);
  assert.deepEqual(locate(segs, 0), { idx: 0, into: 0, left: 300, start: 0, done: false });
  const l = locate(segs, 330);
  assert.equal(l.idx, 1);
  assert.equal(segs[l.idx].type, 'run');
  assert.equal(l.left, 30);
  assert.equal(locate(segs, 99999).done, true);
  const nums = intervalNumbers(segs);
  assert.deepEqual(nums[1], { n: 1, of: 8 });
  assert.equal(nums[0], null);
});

test('just right advances with a rest day', () => {
  const { state, change } = applyFeedback(newState(), { pos: 0, feeling: 'right', completed: true }, day(0));
  assert.equal(state.pos, 1);
  assert.equal(change.kind, 'advance');
  assert.equal(state.log.length, 1);
  assert.equal(nextWorkout(state, day(0)).restLeft, 1);
  assert.equal(nextWorkout(state, day(1)).restLeft, 0);
});

test("couldn't finish repeats eased, twice steps back a week", () => {
  let s = setPosition(newState(), 6);
  s = run(s, 'failed', 0);
  assert.equal(s.pos, 6);
  assert.equal(s.ease, true);
  const w = nextWorkout(s, day(2));
  assert.equal(w.eased, true);
  assert.ok(totals(w.main).walk > totals(PLAN[6].main).walk);
  s = run(s, 'failed', 2);
  assert.equal(s.pos, 5);
  assert.equal(s.log.at(-1).change.kind, 'back');
});

test('hard eases the next run; two hard in a row repeats', () => {
  let s = run(newState(), 'hard', 0);
  assert.equal(s.pos, 1);
  assert.equal(s.ease, true);
  s = run(s, 'hard', 2);
  assert.equal(s.pos, 1);
  assert.equal(s.ease, true);
  s = run(s, 'right', 4);
  assert.equal(s.pos, 2);
  assert.equal(s.ease, false);
});

test('two easy runs in a row skip to the next week', () => {
  let s = run(newState(), 'easy', 0);
  assert.equal(s.pos, 1);
  s = run(s, 'easy', 2);
  assert.equal(s.pos, 3);
  assert.equal(s.log.at(-1).change.kind, 'jump');
});

test('pain means extra rest and a gentler repeat', () => {
  const { state, change } = applyFeedback(setPosition(newState(), 4), { pos: 4, feeling: 'right', pain: true, completed: true }, day(0));
  assert.equal(state.pos, 4);
  assert.equal(state.ease, true);
  assert.equal(change.kind, 'repeat');
  assert.equal(nextWorkout(state, day(1)).restLeft, 2);
});

test('long breaks ease or step back', () => {
  const s = run(setPosition(newState(), 10), 'right', 0);
  assert.equal(nextWorkout(s, day(2)).eased, false);
  const w10 = nextWorkout(s, day(12));
  assert.equal(w10.eased, true);
  assert.equal(w10.pos, 11);
  const w21 = nextWorkout(s, day(25));
  assert.equal(w21.pos, 6);
});

test('finishing the last run graduates', () => {
  const s = run(setPosition(newState(), 26), 'right', 0);
  assert.equal(s.pos, TOTAL);
  assert.equal(s.log.at(-1).change.kind, 'finish');
  assert.equal(nextWorkout(s, day(2)).graduated, true);
});

test('painMentioned spots pain words but not "no pain"', () => {
  assert.equal(painMentioned('my left knee hurts a bit'), true);
  assert.equal(painMentioned('Shin splints again'), true);
  assert.equal(painMentioned('felt great, no pain at all'), false);
  assert.equal(painMentioned('breathing was hard'), false);
});
