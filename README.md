# Workout Planner

A phone-first workout tracker and planner. No account, no server: it runs in the browser, works offline, and can be added to your home screen like an app.

## Features

- **Import from Hevy.** Load your Hevy CSV export. Your workout history comes in, and routines are created from the workouts you do repeatedly. Hevy Pro users can pull routines with an API key instead.
- **Workout tracker.** Each exercise shows its sets, target rep range, and what you did last time. Enter weight and reps as you go. Weights are pre-filled from your last session.
- **Warm-up sets.** In the routine editor, turn on **Warm-up sets** for an exercise and choose 1–3. They appear first in the workout, marked **W**, with weights that ramp up to your working weight (for example 50% × 8, then 75% × 4). The rest after a warm-up is shorter (1:00 by default; change it in Settings). Warm-ups don't count toward progress or PRs.
- **3-minute rest timer.** It starts when you check off a set. When rest is over you get a beep, a vibration, and a notification that tells you whether the next thing is another set or a new exercise. The rest length can be changed in Settings or per exercise.
- **Alternatives.** Tap **⇄ Swap** on any exercise to see options that train the same movement pattern. Top picks are marked with ★, each option has a one-line reason, and you can filter by equipment (barbell, dumbbell, cable, machine, bodyweight).
- **When to move up.** The app uses double progression: when every working set reaches the top of the rep range, it tells you to add weight (+5 lb upper body, +10 lb lower body; 2.5/5 kg) and pre-fills the heavier weight next time. If you stall for 3 sessions it suggests a deload or a swap.
- **45-minute sessions, 3–4 days a week.** Every routine shows an estimated duration. During a workout it projects your finish time and warns you if you'll go over your target. The weekly goal and schedule are in the Plan tab. Two starter programs are sized for about 45 minutes with 3-minute rests: 3-day Full Body and 4-day Upper/Lower.
- **History.** See every workout, the progress of each exercise, estimated 1-rep max, and PRs on the finish screen.
- **Night mode.** A dark theme is always on.
- **Backup.** Download or restore a JSON backup from Settings.

## Couch to 5K (running app)

A separate app lives in [`run/`](run/) and can be installed on its own (open `…/Workout-Planner/run/` and add it to your home screen). It takes you from walking to running 30 minutes non-stop in 9 weeks.

- **The classic plan.** 3 runs a week for 9 weeks. Every run starts with a 5-minute warm-up walk and ends with a 5-minute cool-down walk. Week 1 is 8 × (run 1:00, walk 1:30). Week 9 is 30 minutes non-stop. The **Plan** tab shows every run. Tap one to see its intervals, or to start there if you already run a bit.
- **Interval display.** A full-screen card shows **RUN**, **WALK**, **WARM UP** or **COOL DOWN** in its own color, with a countdown ring, "Run 3 of 8", what's next, and a timeline bar of the whole workout. You get a voice cue, a tone and a vibration at every change, plus a 3-2-1 countdown beep. You can pause, go back or skip. The screen stays on while you run.
- **Tell it how the run felt.** After each run, pick 😄 Easy, 🙂 Just right, 😮‍💨 Hard or 😣 Couldn't finish. You can tick 🩹 Something hurts and add notes. The next workout changes to match:
  - Just right → next run in the plan.
  - Easy twice in a row → skip the rest of the week.
  - Hard → next run with walk breaks 30 s longer. Hard twice in a row → repeat that run, gentler.
  - Couldn't finish → repeat the run with longer walk breaks. Twice on the same run → go back to the end of the previous week.
  - Something hurts → 2 rest days, then a gentler repeat. If your notes mention pain, the app reminds you to tick the box.
  - Long break → after 10+ days off, walk breaks are longer. After 21+ days, you go back a week.
  - A long non-stop run is made gentler by adding a 90 s walk halfway through.
- **History** keeps every run, how it felt, your notes and what changed. **Undo** fixes a mis-tap.

## Importing from Hevy

1. In Hevy go to **Profile → ⚙️ Settings → Export & Import Data → Export Workouts**, then save the `.csv` file.
2. In this app go to **Plan → Import from Hevy → Choose Hevy CSV**.
3. Pick which routines to create, then tap **Import**.

## Putting it on your phone

The app is static files, so it can be hosted anywhere. GitHub Pages is set up:

1. In the repo go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. On a free plan, Pages needs a public repo.
2. Go to **Actions → Deploy to GitHub Pages → Run workflow**. Later pushes deploy automatically.
3. Open `https://<your-username>.github.io/Workout-Planner/` on your phone.
   - **iPhone:** Safari → Share → **Add to Home Screen**. Open it from the home-screen icon; notifications only work in that mode on iOS 16.4+.
   - **Android:** Chrome → ⋮ → **Add to Home screen / Install app**.
4. Tap **Settings → Notifications → Enable**, then **Test alert** to check it works.

**Tip:** Phones pause background web apps. For reliable alerts, leave the app open. "Keep screen on during workouts" is enabled by default for this.

## Development

```sh
npm start   # serves on http://localhost:8080
npm test    # unit tests for import, progression, planning and Couch to 5K logic
```

Code layout: `js/logic.js` (import, progression, estimates — pure and tested), `js/exercises.js` (exercise library and alternatives), `js/programs.js` (starter programs), `js/app.js` (UI). Data is stored in `localStorage` on the device. The running app is `run/js/c25k.js` (plan + adaptation rules, tested) and `run/js/app.js` (UI).
