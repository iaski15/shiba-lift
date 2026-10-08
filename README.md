# 🐕 Shiba Lift

A cute workout tracker with real progressive overload.

## Build the app (Android APK)
Shiba Lift is a standalone app. It doesn't need Expo Go or a running dev server.

Requirements: Node, JDK 17 or 21, and the Android SDK (`ANDROID_HOME`).
```
npm install
npm run build:apk
```
The APK is copied to `release/ShibaLift.apk`. The script finds the Android SDK and a JDK 17/21 itself; set `ANDROID_HOME` / `JAVA_HOME` if they're somewhere unusual. Copy it to your phone and open it to install (allow "install unknown apps" once).

> The release APK is signed with the debug key, which is fine for installing on your own phones. Publishing to the Play Store needs a real upload key (EAS or a Gradle signing config).

`android/` is generated from `app.json` (`npx expo prebuild`), so don't edit it by hand. Icons come from `node scripts/make-icons.js`.

## Develop
```
npm run android    # builds a debug app on a connected phone/emulator, then live-reloads your edits
```

## Turn on the social feed (optional)
Workout tracking works fully offline without this. To turn on the feed:
1. Create a free project at supabase.com.
2. Open **SQL Editor**, paste in `supabase/schema.sql` and run it.
3. Go to **Authentication → Sign In / Providers → Email** and turn off "Confirm email" if you want instant sign-up.
4. Copy `.env.example` to `.env` and fill in the **Project URL** and the **Publishable key** (`sb_publishable_…`; older projects call it the anon key). You'll find both under **Project Settings → API Keys** (the URL is also on the project's home page). Never use the secret / service_role key here: it ends up inside the app.
5. Rebuild the app (`npm run build:apk`). The keys are baked in at build time.

## How progression works
Each exercise has a rep range (8–12 by default) and an increment (2.5 kg by default). You can change both by tapping an exercise in the Exercises tab.
- If you hit the top of the range on every working set, the next workout suggests +increment at the bottom of the range.
- Otherwise it suggests the same weight with +1 rep per set.

Suggestions appear as grey placeholders. Tapping ✓ on an empty set uses the suggestion.

The rest timer also sends a "rest over" notification, so you hear about it with the app in the background. It plays a soft chime (`assets/sounds/rest.wav`, regenerate with `node scripts/make-sound.js`) and uses an exact alarm so it isn't delayed.

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
