# Queless Driver (native)

This repository is the native **Queless Driver** app. There is no web version: the
temporary Vite port was removed, the Expo config targets only iOS and Android,
and the app lives at the repository root.

The behavioral contract against the original Flutter app and the retired web
port stays in [`PORTING.md`](PORTING.md).

## Stack

| Concern | Implementation |
| --- | --- |
| Framework | Expo SDK 58 + React Native 0.88 + React 19 + TypeScript |
| Routing | Expo Router (`app/`) |
| State | `zustand` stores |
| Persistence | `@react-native-async-storage/async-storage` (`src/lib/storage.ts`) |
| Backend | `@supabase/supabase-js` |
| Core models/statuses/theme | `@queless/core@^0.1.0` from npm |
| Fonts | Plus Jakarta Sans 400/600/700/800, bundled locally |
| Icons | `@expo/vector-icons` |
| Notifications/location | Expo notifications + TaskManager background location |
| Crash reporting | Sentry (`queless-driver-mobile`), errors + tracing only |

## Getting started

```bash
cp .env.example .env       # fill in EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install                # use npm.cmd on Windows if scripts are restricted
npm run start              # Expo Go
```

Expo Go is supported for UI work. Since SDK 53 it no longer ships the native
notification module, so remote push tokens/topics and local notifications are
disabled there; the Supabase realtime order bridge still drives the app. Use a
development build when testing push alerts, native Sentry, or hidden system bars.

Native builds require a development client. The EAS project is
`@developers_sourcecodes/queless-driver-mobile`
(ID `ccc4dfcb-0bbc-4d1e-8ae4-a69572cddf88`).

Scripts (run from the repository root):

- `npm run start` — Expo Go dev server
- `npm run start:dev-client` — custom native development build
- `npm run ios` / `npm run android` — local native run
- `npm run typecheck` — TypeScript check
- `npx expo export --platform ios|android` — production JS bundle check
- `npm run sourcemaps:upload` — export iOS/Android bundles and upload source maps

## Environment

Only public values belong in Expo env vars. Paystack secret keys and the Sentry
auth token must never be `EXPO_PUBLIC_*`.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (required) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (required) |
| `EXPO_PUBLIC_APP_ENV` | `dev` / `stage` / `prod` |
| `EXPO_PUBLIC_ENABLE_DEVICE_BINDING` | Dev-only override of the server device-binding policy |
| `EXPO_PUBLIC_PAYSTACK_SUBACCOUNT_PERCENTAGE_CHARGE` | Queless share on driver subaccounts (0) |

Sentry source maps/debug symbols need `SENTRY_AUTH_TOKEN` (org scope `org:ci`)
in EAS secrets for `production`, `preview`, and `development`. Native EAS builds
upload them automatically through the Sentry Expo plugin; for manual
EAS Update/export uploads, pull the token locally and run
`npm run sourcemaps:upload`.

## Behaviors preserved

- Forced SMS device verification before `/home`; no deep link or notification tap
  can bypass a pending challenge.
- 30-second offer alert/timeout, next-driver dispatch, and the full
  `out_for_delivery` → `arrived` → `delivered` flow.
- Live location published from the native background task to
  `driver_assignments` and mirrored to `driver_locations`.
- Runs edge-to-edge: the Android navigation bar and status bar are hidden while
  the app is open, and the iOS status bar is hidden. Expo Go and stale dev
  clients do not include the native navigation-bar module, so the app skips that
  override instead of crashing. Use a fresh native build/dev client for hidden
  bars and native Sentry reporting.
- Driver notifications use `app_id: driver` with real `ios`/`android` platform
  and OS version; topics are `DRIVER_ORDERS_READY`, `driver-<driverId>`, and
  `marketing`.
- Earnings use the internal `driver_payments` ledger and Paystack transfers,
  with bank-details validation and Tuesday/Thursday payout batching.
- Customer theme: Plus Jakarta Sans, neutral light/dark surfaces, crimson
  `#D13540`, inline errors, and no browser APIs or web alerts.

## Structure

```text
app/                   Expo Router routes and route guards
assets/                icon, splash, alert sound
src/
  components/          native design-system primitives and hosts
  config/              app/Supabase configuration
  core/                device-binding protocol
  lib/                 storage, formatting, geo, errors
  models/              shared/core model re-exports
  screens/             auth, home, notification screens
  services/            auth, orders, location, push, payouts, version
  stores/              auth, theme, toast, dialog, update state
  theme/               colors, typography, fonts, ThemeProvider
NATIVE_CONTRACT.md     shared imports and route/copy contract
```

`PORTING.md` documents the original design-system and service contracts.
