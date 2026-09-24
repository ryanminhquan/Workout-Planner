# Workout Planner

A phone-first workout tracker and planner. No account, no server: it runs in the browser, works offline, and can be added to your home screen like an app.

## Features

- **Import from Hevy.** Load your Hevy CSV export. Your workout history comes in, and routines are created from the workouts you do repeatedly. Hevy Pro users can pull routines with an API key instead.
- **Workout tracker.** Each exercise shows its sets, target rep range, and what you did last time. Enter weight and reps as you go. Weights are pre-filled from your last session.
- **3-minute rest timer.** It starts when you check off a set. When rest is over you get a beep, a vibration, and a notification that tells you whether the next thing is another set or a new exercise. The rest length can be changed in Settings or per exercise.
- **Alternatives.** Tap **⇄ Swap** on any exercise to see options that train the same movement pattern. Top picks are marked with ★, each option has a one-line reason, and you can filter by equipment (barbell, dumbbell, cable, machine, bodyweight).
- **When to move up.** The app uses double progression: when every working set reaches the top of the rep range, it tells you to add weight (+5 lb upper body, +10 lb lower body; 2.5/5 kg) and pre-fills the heavier weight next time. If you stall for 3 sessions it suggests a deload or a swap.
- **45-minute sessions, 3–4 days a week.** Every routine shows an estimated duration. During a workout it projects your finish time and warns you if you'll go over your target. The weekly goal and schedule are in the Plan tab. Two starter programs are sized for about 45 minutes with 3-minute rests: 3-day Full Body and 4-day Upper/Lower.
- **History.** See every workout, the progress of each exercise, estimated 1-rep max, and PRs on the finish screen.
- **Night mode.** A dark theme is always on.
- **Backup.** Download or restore a JSON backup from Settings.

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
npm test    # unit tests for import, progression and planning logic
```

Code layout: `js/logic.js` (import, progression, estimates — pure and tested), `js/exercises.js` (exercise library and alternatives), `js/programs.js` (starter programs), `js/app.js` (UI). Data is stored in `localStorage` on the device.
