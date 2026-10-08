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

Set `REST_SECONDS` in `src/app/active.tsx` to change the rest timer.

## Checks
```
npm test          # progression + PR logic
npx tsc --noEmit
npx expo lint
```

The exercise library comes from [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain).
