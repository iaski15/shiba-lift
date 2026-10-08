# 🐕 Shiba Lift

A cute workout tracker with real progressive overload.

## Run it
```
npm install
npx expo start
```
Scan the QR code with **Expo Go** on your phone.

## Turn on the social feed (optional)
Workout tracking works fully offline without this. To turn on the feed:
1. Create a free project at supabase.com.
2. Open **SQL Editor**, paste in `supabase/schema.sql` and run it.
3. Go to **Authentication → Sign In / Providers → Email** and turn off "Confirm email" if you want instant sign-up.
4. Copy `.env.example` to `.env` and fill in the Project URL and anon key from **Project Settings → API**.
5. Restart `npx expo start`.

## How progression works
Each exercise has a rep range (8–12 by default) and an increment (2.5 kg by default). You can change both by tapping an exercise in the Exercises tab.
- If you hit the top of the range on every working set, the next workout suggests +increment at the bottom of the range.
- Otherwise it suggests the same weight with +1 rep per set.

Suggestions appear as grey placeholders. Tapping ✓ on an empty set uses the suggestion.

In Expo Go on Android the rest timer is in-app only (Expo Go can't load `expo-notifications` there). A development build (`npx expo run:android`) also gets the background "rest over" notification.

Set `REST_SECONDS` in `src/app/active.tsx` to change the rest timer.

## Routines & supersets
On the Workout tab, use **+ New routine** to build your Push / Pull / Legs: set the exercises, the number of sets, and the order (↑).
- Tap **🔗 Superset** to link an exercise with the next one. Mid-superset the rest timer doesn't start, so you go straight to the next exercise. Rest starts after the last exercise in the group.
- Tap a routine to start it. **💾 Save as routine** or **Update routine** on the workout screen saves your changes back to it.
- The rest timer defaults to 2:00 (`REST_SECONDS` in `src/app/active.tsx`).

## Sync with Hevy (Hevy Pro)
1. Get your API key at **hevy.com/settings?developer**.
2. In Shiba Lift, open **Me → Connect Hevy**, paste the key and tap **Connect & sync**. The key is stored in the phone's secure storage.
- The first sync pulls your whole Hevy history. After that it syncs automatically every time the app opens, or tap **🔄 Sync now**.
- Workouts you edit or delete in Hevy are updated or removed here too. A workout you imported earlier from CSV is replaced by its synced copy, so nothing is doubled.
- Hevy's API has no friends or followers, so the social side stays in Shiba Lift.

## Import from Hevy (CSV, no Pro needed)
1. In Hevy, go to **Profile → ⚙️ Settings → Export & Import Data → Export Workouts**. You get a `.csv` file.
2. Put the file on your phone, open the **Me** tab and tap **📥 Import Hevy workouts (CSV)**.
- Hevy exercise names that aren't in the library are added as custom ⭐ exercises with the same name. Keep using those so your history and progression carry over.
- Cardio and timed sets (no reps) are skipped. `weight_lbs` exports are converted to kg.
- Importing the same file again skips workouts that are already there, so it's safe to re-import a newer export.

## Checks
```
npm test          # progression + PR logic
npx tsc --noEmit
npx expo lint
```

The exercise library comes from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain).
