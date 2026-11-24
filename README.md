# queless-driver-react

React + TypeScript port of the Queless **driver** Flutter app
([queless_driver](https://github.com/SalmonPhapang/queless_driver.git)).

The goal of this port is behavioural parity: every service, model, auth gate,
order lifecycle transition, payout query, notification flow, device-binding
challenge and screen from the Flutter app is represented here. The UI is
rebuilt with the same Material 3 palette and copy, using plain CSS (no UI
framework) so the bundle stays small.

## Stack

| Concern | Flutter original | React port |
| --- | --- | --- |
| Framework | Flutter / Dart | Vite + React 19 + TypeScript |
| Routing | `Navigator` + named routes | `react-router-dom` |
| State | `ChangeNotifier` + `provider` | `zustand` stores |
| Persistence | `shared_preferences` | `localStorage` (`src/lib/storage.ts`) |
| Backend | `supabase_flutter` | `@supabase/supabase-js` |
| Icons | Material Icons | `lucide-react` |
| Fonts | Google Fonts (Plus Jakarta Sans) | same, via Google Fonts CDN |

## Getting started

```bash
cp .env.example .env      # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

PowerShell note: if script execution is restricted, use `npm.cmd run dev` and
`npx.cmd …`.

Scripts: `dev`, `build` (`tsc -b && vite build`), `preview`, `lint` (oxlint).

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (required) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (required) |
| `VITE_APP_ENV` | `dev` / `stage` / `prod` |
| `VITE_ENABLE_DEVICE_BINDING` | Dev-only override of the server device-binding policy |
| `VITE_PAYSTACK_SUBACCOUNT_PERCENTAGE_CHARGE` | Share retained by Queless on driver subaccounts |
| `VITE_APP_VERSION` | Displayed version, mirrors `PackageInfo.version` |
| `VITE_APP_BUILD_NUMBER` | Update-check build number, mirrors `PackageInfo.buildNumber` |

## Structure

```
src/
  components/        shared UI (design-system primitives + app-wide hosts)
  config/            AppConfig, Supabase client/edge client, telemetry
  core/              edge client, device-binding protocol
  lib/               storage, formatting, geo, class-name helper
  models/            statuses, orders, drivers, assignments, notifications, versions
  screens/
    auth/            welcome, login, signup, onboarding, permissions, success screens
    home/            tabs, order details, wallet
    notifications/   durable inbox
  services/          auth, driver, orders, payouts, location, push, version, …
  stores/            auth, theme, toast, dialog
```

`PORTING.md` documents the design-system classes and service contracts used by
the screen ports.

## Authentication & routing gates

`src/screens/RootGate.tsx` reproduces `RootRouter` from `lib/main.dart` in the
same order:

1. restore session (device-binding check on cold start);
2. inactive driver → blocked screen with logout;
3. missing `full_name` → `/onboarding`;
4. not verified → `/registration-success` (first time) → `/permissions` → home;
5. verified → `/approval-success` (first time) → `/permissions` → home.

Login additionally runs the SMS device challenge (`ensureVerified`) before the
session is let through, exactly like the Flutter login screen.

## Platform parity notes (web adaptations)

These Flutter capabilities have no direct browser equivalent. Each service
keeps the original public API and substitutes the closest durable behaviour:

| Flutter | Web port | Notes |
| --- | --- | --- |
| `flutter_local_notifications` + FCM | Web Notifications + realtime `notifications` subscription | `PushService`; stores a stable per-install token in `user_fcm_tokens`, keeps topic subscriptions locally, sounds/vibrates for new orders. A native wrapper is required for true background push. |
| Android foreground location service | `navigator.geolocation.watchPosition` | Publishing stops when the tab is closed; 10 m filter and 3 s throttle preserved. |
| Battery-optimisation exemption | no-op that reports exempt | `BatteryService`; browsers have no equivalent. |
| Shorebird OTA | redeploy assets | `ShorebirdService` reports `unavailable` on web. |
| `PackageInfo` | `VITE_APP_VERSION` / `VITE_APP_BUILD_NUMBER` | Drives the same `app_versions` update check and forced-update dialog. |
| Image picker (gallery/camera) | `<input type="file" accept="image/*">` | Upload path/bucket unchanged (`driver/${userId}_${Date.now()}.png`). |
| Vibrate / native alert | Web Audio tone + `navigator.vibrate` where supported | Same 30-second new-order alert loop. |
| Deep link to location settings | browser site-settings instructions | `LocationService.openLocationSettings`. |
| `RefreshIndicator` pull-to-refresh | reload on tab entry / resume | Lists have no extra refresh chrome; empty states keep their REFRESH button. The browser pull gesture does not trigger a reload. |
| `PopScope(canPop: false)` forced dialogs | Escape/backdrop blocked | Browser Back cannot be reliably intercepted; forced update and device-challenge dialogs still reject Escape and backdrop taps. |

## Backend contract used

- Edge functions: `orders-status`, `paystack-settlements`
  (`get_banks`, `settlement_data`, `settled_refs`, `create_recipient`,
  `create_subaccount`, `update_subaccount`), `driver-device-verify`
  (`check`, `send_otp`, `verify_otp`).
- RPCs: `accept_dispatch_offer(p_assignment_id)`,
  `decline_dispatch_offer(p_assignment_id, p_reason?)`.
- Tables: `orders`, `driver_assignments`, `drivers`, `users`,
  `driver_payments`, `driver_locations`, `notifications`, `payments`,
  `app_settings`, `app_versions`, `edge_call_events`, `user_fcm_tokens`.
- Storage bucket: `driver`.

Driver-facing ids are always the Supabase **auth user id** (`drivers.user_id`);
`driver_assignments.driver_id` references `auth.users(id)`.

## Deployment

Any static host works. For SPA routing, rewrite unknown paths to `index.html`.
On Vercel:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Set the `VITE_*` variables in the project environment before building.
