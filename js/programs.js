// Starter programs sized for ~45 min with 3-min rests (12 working sets).
const ex = (name, sets, repMin, repMax) => ({ name, sets, repMin, repMax });

export const PROGRAMS = [
  {
    id: 'fb3',
    name: '3-day Full Body',
    blurb: 'Mon / Wed / Fri. Every muscle 3×/week. Best if you can reliably train 3 days.',
    days: [1, 3, 5],
    routines: [
      { name: 'Full Body A', exercises: [ex('Squat (Barbell)', 3, 5, 8), ex('Bench Press (Barbell)', 3, 6, 10), ex('Seated Cable Row - V Grip (Cable)', 3, 8, 12), ex('Lateral Raise (Dumbbell)', 3, 12, 15)] },
      { name: 'Full Body B', exercises: [ex('Romanian Deadlift (Barbell)', 3, 6, 10), ex('Overhead Press (Barbell)', 3, 6, 10), ex('Lat Pulldown (Cable)', 3, 8, 12), ex('Incline Curl (Dumbbell)', 3, 10, 15)] },
      { name: 'Full Body C', exercises: [ex('Leg Press (Machine)', 3, 8, 12), ex('Incline Bench Press (Dumbbell)', 3, 8, 12), ex('Chest Supported Incline Row (Dumbbell)', 3, 8, 12), ex('Triceps Rope Pushdown', 3, 10, 15)] },
    ],
  },
  {
    id: 'ul4',
    name: '4-day Upper / Lower',
    blurb: 'Mon / Tue / Thu / Fri. More volume per muscle; good when you can hit 4 days.',
    days: [1, 2, 4, 5],
    routines: [
      { name: 'Upper A', exercises: [ex('Bench Press (Barbell)', 3, 6, 10), ex('Dumbbell Row', 3, 8, 12), ex('Shoulder Press (Dumbbell)', 3, 8, 12), ex('Lat Pulldown (Cable)', 3, 8, 12)] },
      { name: 'Lower A', exercises: [ex('Squat (Barbell)', 3, 5, 8), ex('Romanian Deadlift (Barbell)', 3, 6, 10), ex('Seated Leg Curl (Machine)', 3, 10, 15), ex('Standing Calf Raise (Machine)', 3, 10, 15)] },
      { name: 'Upper B', exercises: [ex('Incline Bench Press (Dumbbell)', 3, 8, 12), ex('Pull Up', 3, 6, 10), ex('Lateral Raise (Cable)', 3, 12, 15), ex('Bayesian Curl (Cable)', 3, 10, 15)] },
      { name: 'Lower B', exercises: [ex('Trap Bar Deadlift', 3, 5, 8), ex('Bulgarian Split Squat', 3, 8, 12), ex('Leg Extension (Machine)', 3, 10, 15), ex('Hanging Leg Raise', 3, 10, 15)] },
    ],
  },
];
