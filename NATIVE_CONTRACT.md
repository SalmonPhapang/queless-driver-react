# Native driver port contract

This Expo app at the repository root is the driver app. The temporary Vite web port has been removed.

## Shared imports available to every screen

```ts
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../theme/ThemeContext'; // colors, isDark, typography, mode, setMode
import { typography } from '../theme/typography';
import { Button } from '../components/Button';       // title, onPress, variant?: primary|green|outline|ghost|danger, size?: sm|md, block?, loading?, disabled?, icon?: ReactNode
import { AppBar } from '../components/AppBar';       // title, subtitle?, right?, onBack?
import { Screen } from '../components/Screen';       // children, padded?, scroll?, contentContainerStyle?
import { Input } from '../components/Input';         // label, error?, multiline?, TextInputProps
import { SelectField } from '../components/SelectField'; // label, value, options:{value,label}[], onChange(value), error?
import { Switch } from '../components/Switch';       // value, onValueChange, label?
import { Card } from '../components/Card';           // children, style?, onPress?
import { Badge } from '../components/Badge';         // label, tone?: green|orange|red|blue|gray
import { StatusMessage } from '../components/StatusMessage'; // variant, title, message, onDismiss?
import { EmptyState } from '../components/EmptyState'; // title, message?, icon?, action?
import { Spinner, LoadingScreen } from '../components/Spinner';
import { Avatar } from '../components/Avatar';       // name?, uri?
import { StatusIcon } from '../components/StatusIcon'; // status
import { QuelessLogo } from '../components/QuelessLogo'; // size?
import { OrderCard } from '../components/OrderCard'; // order, onPress?, children?
import { LocationInfoRow } from '../components/LocationInfoRow'; // label, address, icon?
import { UiService } from '../services/uiService';
import { Prefs, PrefKeys } from '../lib/storage';    // synchronous cached API after startup init()
```

Navigation: use `router.push`, `router.replace`, `router.back` with routes:
`/welcome`, `/login`, `/signup`, `/onboarding`, `/permissions`, `/registration-success`, `/approval-success`, `/home/available`, `/home/active`, `/home/history`, `/home/profile`, `/home/wallet`, `/home/wallet/bank-details`, `/home/notifications`, `/home/orders/:orderId`.

All visible copy, validation, ordering, status transitions, and edge cases must match the Vite source under `../src`. Icons may use `@expo/vector-icons` MaterialCommunityIcons instead of lucide.

## Services are already ported

`AuthService`, `DriverService`, `OrderService`, `PayoutService`, `LocationService`, `BackgroundLocationService`, `PushService`, `BatteryService`, `DeviceBindingService`, `DeviceBindingPolicy`, `VersionService`, `NotificationInboxService`, `SupabaseConfig`, `useAuthStore` keep the same public APIs as the Vite source. `DriverService.uploadProfileImage(userId, uri)` accepts a native image URI. `Prefs` is synchronous after root startup calls `Prefs.init()`.

## Theme

Use `useTheme()` + `typography`; no hard-coded light/dark colours. Crimson primary is `#D13540`. Font family is Plus Jakarta Sans 400/600/700/800.
