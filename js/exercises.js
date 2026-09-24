// Exercise library used for swaps/alternatives. Names follow Hevy's naming
// ("Exercise (Equipment)") so imported workouts match automatically.

export const PATTERNS = {
  chest_press:  { label: 'Chest press',            related: ['chest_iso'] },
  chest_iso:    { label: 'Chest isolation',        related: ['chest_press'] },
  vert_push:    { label: 'Overhead press',         related: ['side_delt'] },
  side_delt:    { label: 'Side delts',             related: ['vert_push'] },
  rear_delt:    { label: 'Rear delts / upper back', related: ['row'] },
  vert_pull:    { label: 'Vertical pull (lats)',   related: ['row'] },
  row:          { label: 'Row (mid back)',         related: ['vert_pull', 'rear_delt'] },
  squat:        { label: 'Squat pattern (quads)',  related: ['single_leg', 'quad_iso'] },
  single_leg:   { label: 'Single-leg / lunge',     related: ['squat'] },
  hinge:        { label: 'Hip hinge',              related: ['glute', 'ham_iso'] },
  glute:        { label: 'Glutes',                 related: ['hinge'] },
  quad_iso:     { label: 'Quad isolation',         related: ['squat'] },
  ham_iso:      { label: 'Hamstring curl',         related: ['hinge'] },
  calves:       { label: 'Calves',                 related: [] },
  biceps:       { label: 'Biceps',                 related: [] },
  triceps:      { label: 'Triceps',                related: [] },
  core:         { label: 'Core',                   related: [] },
};

// star: a strong default pick for most people. note: why you'd pick it.
const L = (name, pattern, equip, note, star = false) => ({ name, pattern, equip, note, star });

export const LIBRARY = [
  // Chest press
  L('Bench Press (Barbell)', 'chest_press', 'Barbell', 'Classic strength builder; easiest to load progressively.', true),
  L('Bench Press (Dumbbell)', 'chest_press', 'Dumbbell', 'Deeper stretch and freer shoulder path than barbell — friendlier on shoulders.', true),
  L('Incline Bench Press (Barbell)', 'chest_press', 'Barbell', 'Shifts work to upper chest and front delts.'),
  L('Incline Bench Press (Dumbbell)', 'chest_press', 'Dumbbell', 'Upper-chest focus with a big stretch; great hypertrophy pick.', true),
  L('Chest Press (Machine)', 'chest_press', 'Machine', 'Stable, easy to push close to failure safely; no spotter needed.', true),
  L('Smith Machine Bench Press', 'chest_press', 'Machine', 'Fixed bar path — lets you train hard without a spotter.'),
  L('Decline Bench Press (Barbell)', 'chest_press', 'Barbell', 'Lower-chest emphasis, shorter range; easy on shoulders.'),
  L('Push Up', 'chest_press', 'Bodyweight', 'No equipment; add a band or weight plate to progress.'),
  L('Chest Dip', 'chest_press', 'Bodyweight', 'Big lower-chest stretch; skip if shoulders are cranky.'),
  // Chest isolation
  L('Chest Fly (Dumbbell)', 'chest_iso', 'Dumbbell', 'Loaded stretch at the bottom; keep weights moderate.'),
  L('Cable Fly Crossovers', 'chest_iso', 'Cable', 'Constant tension through the whole range.', true),
  L('Butterfly (Pec Deck)', 'chest_iso', 'Machine', 'Very stable; easy to train close to failure.', true),
  L('Low Cable Fly Crossovers', 'chest_iso', 'Cable', 'Upper-chest bias fly.'),
  // Vertical push
  L('Overhead Press (Barbell)', 'vert_push', 'Barbell', 'Best loadable shoulder strength lift; also trains core.', true),
  L('Shoulder Press (Dumbbell)', 'vert_push', 'Dumbbell', 'Each arm works independently; easier on wrists/shoulders.', true),
  L('Seated Overhead Press (Dumbbell)', 'vert_push', 'Dumbbell', 'Back support removes lower-back strain.'),
  L('Shoulder Press (Machine Plates)', 'vert_push', 'Machine', 'Stable and joint-friendly; great for pushing hard.', true),
  L('Arnold Press (Dumbbell)', 'vert_push', 'Dumbbell', 'Rotation adds front-delt range.'),
  L('Landmine Press', 'vert_push', 'Barbell', 'Angled press — the best option if overhead hurts your shoulder.'),
  // Side delts
  L('Lateral Raise (Dumbbell)', 'side_delt', 'Dumbbell', 'Simple and effective; use light weight and control.', true),
  L('Lateral Raise (Cable)', 'side_delt', 'Cable', 'Tension at the bottom where dumbbells are easiest — often better than DB.', true),
  L('Lateral Raise (Machine)', 'side_delt', 'Machine', 'Stable; easy to take near failure.'),
  L('Upright Row (Cable)', 'side_delt', 'Cable', 'Use a wide grip and stop at chest height to spare shoulders.'),
  // Rear delts
  L('Face Pull', 'rear_delt', 'Cable', 'Rear delts + rotator cuff; great for shoulder health.', true),
  L('Rear Delt Reverse Fly (Dumbbell)', 'rear_delt', 'Dumbbell', 'No machine needed; chest-supported is stricter.'),
  L('Rear Delt Reverse Fly (Machine)', 'rear_delt', 'Machine', 'Most stable rear-delt option.', true),
  L('Rear Delt Reverse Fly (Cable)', 'rear_delt', 'Cable', 'Constant tension; cross the cables.'),
  // Vertical pull
  L('Pull Up', 'vert_pull', 'Bodyweight', 'King of back width; add weight once you hit 10+ clean reps.', true),
  L('Chin Up', 'vert_pull', 'Bodyweight', 'Underhand grip adds more biceps; usually easier than pull ups.'),
  L('Pull Up (Assisted)', 'vert_pull', 'Machine', 'Build up to strict pull ups.'),
  L('Lat Pulldown (Cable)', 'vert_pull', 'Cable', 'Easy to load in small jumps; great for any level.', true),
  L('Lat Pulldown - Close Grip (Cable)', 'vert_pull', 'Cable', 'Neutral grip — longer range, elbow friendly.'),
  L('Single Arm Lat Pulldown', 'vert_pull', 'Cable', 'Fixes side-to-side imbalances; big stretch.'),
  L('Straight Arm Lat Pulldown (Cable)', 'vert_pull', 'Cable', 'Lat isolation with no biceps involvement.'),
  // Rows
  L('Bent Over Row (Barbell)', 'row', 'Barbell', 'Heavy compound row; demands a strong lower back.'),
  L('Dumbbell Row', 'row', 'Dumbbell', 'One arm at a time, braced on a bench — back-friendly.', true),
  L('Seated Cable Row - V Grip (Cable)', 'row', 'Cable', 'Stable, easy to load, good stretch.', true),
  L('Chest Supported Incline Row (Dumbbell)', 'row', 'Dumbbell', 'Zero lower-back stress — best swap for barbell rows.', true),
  L('T Bar Row', 'row', 'Barbell', 'Heavy loading with a neutral grip.'),
  L('Seated Row (Machine)', 'row', 'Machine', 'Chest pad removes cheating.'),
  L('Inverted Row', 'row', 'Bodyweight', 'Bodyweight row; raise feet to progress.'),
  // Squat
  L('Squat (Barbell)', 'squat', 'Barbell', 'Top lower-body strength builder.', true),
  L('Front Squat (Barbell)', 'squat', 'Barbell', 'More quads, more upright torso, less back load.'),
  L('Goblet Squat', 'squat', 'Dumbbell', 'Great for learning form or when the rack is busy.'),
  L('Hack Squat (Machine)', 'squat', 'Machine', 'Quad focus with no balance demand — excellent for growth.', true),
  L('Leg Press (Machine)', 'squat', 'Machine', 'Heavy leg work with minimal back stress.', true),
  L('Smith Machine Squat', 'squat', 'Machine', 'Fixed path; feet forward to hit quads.'),
  L('Pendulum Squat (Machine)', 'squat', 'Machine', 'Deep quad stretch; very knee/back friendly.'),
  // Single leg
  L('Bulgarian Split Squat', 'single_leg', 'Dumbbell', 'Brutal but effective; fixes imbalances, low spine load.', true),
  L('Lunge (Dumbbell)', 'single_leg', 'Dumbbell', 'Quads and glutes; step back if knees complain.'),
  L('Walking Lunge (Dumbbell)', 'single_leg', 'Dumbbell', 'Needs floor space; great glute work.'),
  L('Reverse Lunge (Dumbbell)', 'single_leg', 'Dumbbell', 'Most knee-friendly lunge.', true),
  L('Step Up (Dumbbell)', 'single_leg', 'Dumbbell', 'Simple; drive through the front heel.'),
  // Hinge
  L('Deadlift (Barbell)', 'hinge', 'Barbell', 'Whole posterior chain; very fatiguing — keep sets low.'),
  L('Romanian Deadlift (Barbell)', 'hinge', 'Barbell', 'Best hamstring/glute builder among hinges; less fatigue than deadlifts.', true),
  L('Romanian Deadlift (Dumbbell)', 'hinge', 'Dumbbell', 'Same benefits as barbell RDL, easier setup.', true),
  L('Trap Bar Deadlift', 'hinge', 'Barbell', 'Easier on the lower back than conventional.', true),
  L('Good Morning (Barbell)', 'hinge', 'Barbell', 'Hamstrings and back; go light.'),
  L('Back Extension (Weighted Hyperextension)', 'hinge', 'Machine', 'Low-risk hinge; round upper back to bias glutes.'),
  // Glutes
  L('Hip Thrust (Barbell)', 'glute', 'Barbell', 'Best loadable glute lift.', true),
  L('Hip Thrust (Machine)', 'glute', 'Machine', 'Same benefits with no awkward setup.', true),
  L('Glute Bridge', 'glute', 'Bodyweight', 'Floor version; add a plate to progress.'),
  L('Glute Kickback (Cable)', 'glute', 'Cable', 'Isolation finisher.'),
  L('Hip Abduction (Machine)', 'glute', 'Machine', 'Side glutes; lean forward for more glute max.'),
  // Quad iso
  L('Leg Extension (Machine)', 'quad_iso', 'Machine', 'Pure quad work; great finisher.', true),
  L('Reverse Nordic', 'quad_iso', 'Bodyweight', 'Bodyweight quad stretch under load.'),
  L('Sissy Squat', 'quad_iso', 'Bodyweight', 'Bodyweight quad isolation.'),
  // Hamstring curl
  L('Seated Leg Curl (Machine)', 'ham_iso', 'Machine', 'Hamstrings in a lengthened position — better growth than lying.', true),
  L('Lying Leg Curl (Machine)', 'ham_iso', 'Machine', 'Solid option when seated is taken.'),
  L('Nordic Hamstrings Curls', 'ham_iso', 'Bodyweight', 'Very hard; great for injury prevention.'),
  L('Stability Ball Leg Curl', 'ham_iso', 'Bodyweight', 'No-machine option.'),
  // Calves
  L('Standing Calf Raise (Machine)', 'calves', 'Machine', 'Pause at the bottom stretch.', true),
  L('Seated Calf Raise', 'calves', 'Machine', 'Targets the soleus.'),
  L('Calf Press (Machine)', 'calves', 'Machine', 'Done on the leg press.'),
  L('Single Leg Standing Calf Raise (Dumbbell)', 'calves', 'Dumbbell', 'Works anywhere with a step.'),
  // Biceps
  L('Bicep Curl (Barbell)', 'biceps', 'Barbell', 'Heaviest curl option.'),
  L('EZ Bar Biceps Curl', 'biceps', 'Barbell', 'Wrist-friendly barbell curl.'),
  L('Bicep Curl (Dumbbell)', 'biceps', 'Dumbbell', 'Supinate as you curl.', true),
  L('Hammer Curl (Dumbbell)', 'biceps', 'Dumbbell', 'Hits brachialis and forearms too.'),
  L('Incline Curl (Dumbbell)', 'biceps', 'Dumbbell', 'Loaded stretch — among the best for growth.', true),
  L('Preacher Curl (Machine)', 'biceps', 'Machine', 'Strict; no swinging.'),
  L('Bicep Curl (Cable)', 'biceps', 'Cable', 'Constant tension.'),
  L('Bayesian Curl (Cable)', 'biceps', 'Cable', 'Cable behind you = big stretch.', true),
  // Triceps
  L('Triceps Pushdown', 'triceps', 'Cable', 'Easy to learn and load.'),
  L('Triceps Rope Pushdown', 'triceps', 'Cable', 'Spread the rope at the bottom.', true),
  L('Triceps Extension (Cable)', 'triceps', 'Cable', 'Overhead = long-head stretch; best for growth.', true),
  L('Overhead Triceps Extension (Dumbbell)', 'triceps', 'Dumbbell', 'Overhead stretch with one dumbbell.'),
  L('Skullcrusher (Barbell)', 'triceps', 'Barbell', 'Lower the bar behind your head for more stretch.'),
  L('Close Grip Bench Press (Barbell)', 'triceps', 'Barbell', 'Heavy compound triceps work.'),
  L('Triceps Dip', 'triceps', 'Bodyweight', 'Bodyweight; add weight to progress.'),
  // Core
  L('Plank', 'core', 'Bodyweight', 'Anti-extension basics.'),
  L('Hanging Leg Raise', 'core', 'Bodyweight', 'Hard lower-ab work.', true),
  L('Cable Crunch', 'core', 'Cable', 'Loadable ab work — progress like any lift.', true),
  L('Ab Wheel', 'core', 'Bodyweight', 'Very effective anti-extension.'),
  L('Dead Bug', 'core', 'Bodyweight', 'Low-back friendly.'),
  L('Pallof Press', 'core', 'Cable', 'Anti-rotation; great for back health.'),
  L('Crunch', 'core', 'Bodyweight', 'Simple, no equipment.'),
];

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'];

export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const byNorm = new Map(LIBRARY.map((e) => [norm(e.name), e]));

export function findExercise(name) {
  return byNorm.get(norm(name)) || null;
}

// Keyword heuristics for exercises not in the library (custom Hevy names etc).
const KEYWORDS = [
  [/leg ?curl|hamstring curl|nordic/i, 'ham_iso'],
  [/leg extension|sissy|reverse nordic/i, 'quad_iso'],
  [/calf/i, 'calves'],
  [/curl/i, 'biceps'],
  [/tricep|skull|pushdown|push down|dip/i, 'triceps'],
  [/lateral|side raise|upright/i, 'side_delt'],
  [/rear delt|reverse fly|face pull/i, 'rear_delt'],
  [/fly|pec deck|crossover|butterfly/i, 'chest_iso'],
  [/pulldown|pull ?up|chin ?up|pull-up/i, 'vert_pull'],
  [/row/i, 'row'],
  [/overhead press|shoulder press|military|arnold|ohp/i, 'vert_push'],
  [/bench|chest press|push ?up|press up/i, 'chest_press'],
  [/lunge|split squat|step ?up/i, 'single_leg'],
  [/squat|leg press/i, 'squat'],
  [/thrust|bridge|kickback|abduct/i, 'glute'],
  [/deadlift|rdl|good morning|hyperext|back extension/i, 'hinge'],
  [/crunch|plank|ab |abs|leg raise|sit ?up|pallof|core|wheel/i, 'core'],
];

export function guessPattern(name) {
  const lib = findExercise(name);
  if (lib) return lib.pattern;
  for (const [re, p] of KEYWORDS) if (re.test(name)) return p;
  return null;
}

// Returns { pattern, items: [{...exercise, relation: 'same'|'related'}] }
export function alternativesFor(name, equipFilter = []) {
  const pattern = guessPattern(name);
  if (!pattern) return { pattern: null, items: [] };
  const key = norm(name);
  const filt = (e) => norm(e.name) !== key && (!equipFilter.length || equipFilter.includes(e.equip));
  const same = LIBRARY.filter((e) => e.pattern === pattern && filt(e))
    .sort((a, b) => Number(b.star) - Number(a.star))
    .map((e) => ({ ...e, relation: 'same' }));
  const related = LIBRARY.filter((e) => PATTERNS[pattern].related.includes(e.pattern) && e.star && filt(e))
    .map((e) => ({ ...e, relation: 'related' }));
  return { pattern, items: [...same, ...related] };
}

export function searchLibrary(q) {
  const n = norm(q);
  if (!n) return LIBRARY;
  return LIBRARY.filter((e) => norm(e.name).includes(n) || norm(PATTERNS[e.pattern].label).includes(n));
}

const LOWER = new Set(['squat', 'hinge', 'glute', 'single_leg']);
export function isLowerBodyCompound(name) {
  return LOWER.has(guessPattern(name));
}
