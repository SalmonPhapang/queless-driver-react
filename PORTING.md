# Porting contract (Flutter → React)

This file is the shared contract for screen ports. **Do not edit files outside the paths assigned to you.**
If you need screen-specific styling, create a co-located `.css` file and import it from your screen.

## Stack

- Vite + React 19 + TypeScript (strict-ish; `noUnusedLocals` and `noUnusedParameters` are on).
- Routing: `react-router-dom` v7 (`useNavigate`, `useParams`, `Link`).
- State: `zustand` stores in `src/stores`.
- Icons: `lucide-react`.
- No Flutter packages exist. Everything is a browser app.

## Design system

`src/index.css` is the whole design system (ported from `lib/theme.dart`). Use its
class names; inline styles only for one-off measurements/colours.

Key classes:

- Frame: `app-frame` (max-width phone frame), `screen`, `screen-body`, `screen-body--pad`, `screen-body--pad-lg`.
- Layout: `stack` (`stack-sm`, `stack-lg`), `row`, `row-between`, `grow`, `center`, `centered-screen`, `empty`.
- Type: `page-title`, `section-title`, `label`, `text-muted`, `text-faint`, `text-primary`, `text-error`, `text-sm`, `text-xs`, `uppercase`.
- App bar: `appbar`, `appbar--bordered`, `appbar__title`, `icon-btn`, `icon-btn__badge`.
- Buttons: `btn`, `btn--primary|green|outline|ghost|danger`, `btn--block`, `btn--sm|xs`, `btn--pill`.
- Fields: `field`, `field__label`, `field__control`, `field__input`, `field__error`, `field__hint`.
- Card: `card`, `card--padded`, `card--flat`, `card--soft`, `divider`.
- Badge/chip: `badge badge--green|orange|red|blue|gray`, `chip`, `chip--active`.
- Order card: `order-card`, `order-card__header`, `order-card__code`, `order-card__body`, `order-card__meta`, `order-card__footer`, `order-card__actions`, `route-rail`, `route-dot`, `route-line`, `route-info`, `route-info__label`, `route-info__address`.
- Lists: `list`, `list-item`, `list-item__icon`, `list-item__title`, `list-item__subtitle`, `list-item__trailing`.
- Status: `status-hero`, `status-hero__icon|label|value`, `info-card`, `info-card__icon|title|subtitle`, `info-banner info-banner--green|orange`, `summary-row`, `summary-row__value`, `summary-row--bold`, `timeline*`.
- Offer: `offer-banner`, `offer-banner--urgent`, `offer-banner__text`.
- Wallet: `wallet-hero`, `wallet-hero__eyebrow|amount|caption|stats|divider`, `wallet-stat`, `wallet-stat__amount|label|dot`.
- Profile: `profile-hero`, `profile-hero__name|email`, `profile-badges`, `earnings-card`, `earnings-card__icon|label|amount`, `availability-card`, `availability-card__icon`, `availability-card__icon--on`.
- Auth: `auth-screen`, `auth-logo`, `auth-tagline`, `auth-illustration`, `auth-form`, `auth-footer`, `success-hero`, `approval-screen`, `permission-tile*`.
- Modal: `modal-overlay`, `modal`, `modal--wide`, `modal__icon|title|body|actions`, `modal__actions--stack`.
- Misc: `info-banner`, `loading-screen`, `spinner`, `sr-only`, `mt-*`, `mb-*`, `w-full`, `hide-scrollbar`.

Dark mode is automatic via `[data-theme='dark']`; always use the CSS variables
(`var(--text)`, `var(--text-muted)`, `var(--surface)`, `var(--border)`, `var(--primary)`,
`var(--error)`, …) instead of hard-coded black/white.

## Shared components (`src/components`)

```ts
import { Button } from '../components/ui/Button';       // variant, size, block, loading, icon, pill
import { TextField, TextArea, SelectField } from '../components/ui/Field';
import { AppBar } from '../components/ui/AppBar';       // title, back, onBack, start, actions, bordered
import { IconButton } from '../components/ui/IconButton';// label, badge
import { Badge } from '../components/ui/Badge';         // tone, solid
import { Avatar } from '../components/ui/Avatar';       // src, name, size
import { Switch } from '../components/ui/Switch';       // checked, onChange, label
import { Modal } from '../components/ui/Modal';         // title, icon, actions, onClose, dismissible, wide
import { Spinner, LoadingScreen } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusIcon } from '../components/StatusIcon';  // name from OrderStatusX.icon
import { LocationInfoRow } from '../components/LocationInfoRow';
import { UiService } from '../services/uiService';
```

`SelectField` takes `options: { value, label }[]`, `value: string`, `onChange(value)`.
Use `TextField` with `error` for validation text.

## Models (`src/models`)

- `deliveryOrder.ts`: `DeliveryOrder`, `DeliveryOrderModel.baseSubtotal(order)`, `baseTotal(order)`.
- `driver.ts`: `Driver` (`userId` = auth user id, `driverStatus`, `isVerified`, `roleType`, `bankDetails`, `paystack*`).
- `statuses.ts`: `OrderStatus`, `OrderStatusX.displayName/color/icon/isTerminal/driverCanUpdate`, `DriverStatusX`, `PaymentStatusX`.
- `driverAssignment.ts`: `DriverAssignmentModel`, `DriverAssignment.canRespondToOffer/offerRemaining/isOfferExpired`.
- `driverPayment.ts`, `userNotification.ts` (`UserNotificationModel.isOrderRelated/copyWith`).
- `appVersion.ts`.

## Services (`src/services`)

```ts
import { AuthService } from '../services/authService';           // currentUser (Supabase User), signOut, refreshUser, syncFcmToken
import { DriverService } from '../services/driverService';       // getDriverProfile(authUserId), saveProfile({id, …}), uploadProfileImage(userId, File), updateOnlineStatus
import { OrderService } from '../services/orderService';         // fetchAvailableOrders, fetchMyActiveOrders({driverId}), fetchMyOrderHistory({driverId}), fetchOrderById(id), acceptOrder({orderId,driverId,customerId}), markPickedUp(orderId,customerId), markDelivered(orderId,customerId,{amountReceived,receiptNumber}), updateOrderStatus({orderId,newStatus,message}), findOpenOffer({orderId,driverId}), declineDispatchOffer(assignmentId, reason?), describeOfferError(error), fetchTrackableOrderIds({driverId})
import { PayoutService } from '../services/payoutService';       // getBanks, getSettlementData, getSettledOrderIds, getDriverPaymentRefs, getSettledPaymentRefs, saveBankDetails, getBankDetails, types PaystackBank/SettlementData/BankDetails
import { LocationService } from '../services/locationService';   // hasPermission, requestPermission, isPermissionDeniedForever, openLocationSettings, syncTrackingForDriver, getCurrentPosition
import { BackgroundLocationService } from '../services/backgroundLocationService'; // start({driverId, orderIds})
import { NotificationInboxService } from '../services/notificationInboxService';
import { PushService } from '../services/pushService';
import { UiService } from '../services/uiService';               // showInfo, showError, showSuccess, showSuccessDialog({title,message}), showLoading, hideSnackBar
import { SupabaseConfig } from '../config/supabaseClient';       // client, auth, edge, currentUserId
import { useAuthStore } from '../stores/authStore';              // user: Supabase User | null
import { Prefs, PrefKeys } from '../lib/storage';
import { formatCurrency, formatMoney, formatDate, formatDateTime, formatTime, timeAgo } from '../lib/format';
```

Every service method is `async` and throws on failure (except where noted in its JSDoc).

## Realtime

Flutter `.stream(primaryKey: ['id'])` maps to:

```ts
const channel = SupabaseConfig.client
  .channel(`order-${orderId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
      (payload) => { const row = payload.new as Record<string, unknown>; … })
  .subscribe();
return () => { void SupabaseConfig.client.removeChannel(channel); };
```

## Rules

1. **Nothing may be dropped.** Keep every button, validation, dialog, toast, query,
   filter, calculation and edge case from the Flutter file.
2. Preserve visible copy exactly.
3. Use `UiService` for snackbars/dialogs instead of `window.alert`.
4. Any TODO in Flutter stays a comment; do not invent features.
5. No unused imports/variables (`noUnusedLocals`). Prefer explicit `return` types on helpers.
6. Finish by running `npm.cmd exec tsc -- --noEmit -p tsconfig.app.json` and fix errors in **your** files.
