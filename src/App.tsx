import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { DialogHost } from './components/DialogHost';
import { ToastHost } from './components/ToastHost';
import { UpdateDialog } from './components/UpdateDialog';
import { Button } from './components/ui/Button';
import { Spinner } from './components/ui/Spinner';
import { StatusMessage } from './components/ui/StatusMessage';
import { AppConfig } from './config/appConfig';
import { SupabaseConfig } from './config/supabaseClient';
import { errorMessage } from './lib/errors';
import { AuthService } from './services/authService';
import { BackgroundLocationService } from './services/backgroundLocationService';
import { DeviceBindingPolicy } from './services/deviceBindingPolicy';
import { PushService } from './services/pushService';
import { ShorebirdService } from './services/shorebirdService';
import { VersionService } from './services/versionService';
import type { AppVersion } from './models/appVersion';
import type { AppStoreUpdateStatus } from './services/versionService';
import { useAuthStore } from './stores/authStore';
import { useThemeStore, type ThemeMode } from './stores/themeStore';

import { WelcomeScreen } from './screens/auth/WelcomeScreen';
import { LoginScreen } from './screens/auth/LoginScreen';
import { SignupScreen } from './screens/auth/SignupScreen';
import { DriverOnboardingScreen } from './screens/auth/DriverOnboardingScreen';
import { PermissionRequestScreen } from './screens/auth/PermissionRequestScreen';
import { RegistrationSuccessScreen } from './screens/auth/RegistrationSuccessScreen';
import { ApprovalSuccessScreen } from './screens/auth/ApprovalSuccessScreen';
import { RootGate } from './screens/RootGate';
import { AvailableTab } from './screens/home/AvailableTab';
import { ActiveTab } from './screens/home/ActiveTab';
import { HistoryTab } from './screens/home/HistoryTab';
import { ProfileTab } from './screens/home/ProfileTab';
import { OrderDetailsScreen } from './screens/home/OrderDetailsScreen';
import { WalletScreen } from './screens/home/WalletScreen';
import { BankDetailsScreen } from './screens/home/BankDetailsScreen';
import { NotificationInboxScreen } from './screens/notifications/NotificationInboxScreen';

/** Applies `theme_mode` to `<html data-theme>`; system follows the OS live. */
const useAppliedTheme = (mode: ThemeMode): void => {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = mode === 'dark' || (mode === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    if (mode !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [mode]);
};

/** Blocks signed-out access to the authenticated routes. */
const RequireAuth = ({ children }: { children: ReactNode }) => {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (!initialized) {
    return (
      <div className="app-frame">
        <div className="loading-screen">
          <Spinner />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};

/** Flutter has no named auth routes: a signed-in driver never sees these. */
const RequireGuest = ({ children }: { children: ReactNode }) => {
  const initialized = useAuthStore((state) => state.initialized);
  const user = useAuthStore((state) => state.user);

  if (!initialized) {
    return (
      <div className="app-frame">
        <div className="loading-screen">
          <Spinner />
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Old web deep links are accepted, but re-mounted under the live home shell. */
const LegacyOrderRedirect = () => {
  const { orderId } = useParams<{ orderId: string }>();
  return <Navigate to={`/home/orders/${orderId ?? ''}`} replace />;
};

/**
 * Port of `QuelessDriverApp` + the startup sequence in lib/main.dart.
 *
 * Startup order is preserved: Supabase → device-binding policy → push →
 * background location → Shorebird (non-blocking) → session restore, with the
 * version check firing alongside like `RootRouter._checkVersion`.
 */
export const App = () => {
  const mode = useThemeStore((state) => state.mode);
  const [update, setUpdate] = useState<{ version: AppVersion; status: AppStoreUpdateStatus } | null>(
    null,
  );
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [startupError, setStartupError] = useState<string | null>(null);
  useAppliedTheme(mode);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStartupError(null);
      try {
        await SupabaseConfig.initialize();
        await DeviceBindingPolicy.refresh();
        await PushService.initialize();
        await BackgroundLocationService.initialize();
        void ShorebirdService.initialize();
        await AuthService.restoreSession();
      } catch (error) {
        // A broken startup must be visible and retryable, not a silent spinner.
        if (!cancelled) setStartupError(errorMessage(error));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startupAttempt]);

  useEffect(() => {
    void (async () => {
      const result = await VersionService.checkForUpdate();
      if (result.status !== 'none' && result.version) {
        setUpdate({ version: result.version, status: result.status });
      }
    })();
  }, []);

  if (startupError) {
    return (
      <div className="app-viewport">
        <div className="app-frame">
          <div className="centered-screen">
            <StatusMessage
              variant="error"
              title="Could not start Queless Driver"
              message={startupError}
            />
            <Button
              variant="primary"
              className="mt-16"
              onClick={() => setStartupAttempt((attempt) => attempt + 1)}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {!AppConfig.isSupabaseConfigured && (
        <div className="app-frame" style={{ minHeight: 0 }}>
          <div className="info-banner info-banner--orange">
            Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
            (see .env.example).
          </div>
        </div>
      )}

      <Routes>
        <Route path="/" element={<RootGate />} />
        <Route path="/welcome" element={<RequireGuest><WelcomeScreen /></RequireGuest>} />
        <Route path="/login" element={<RequireGuest><LoginScreen /></RequireGuest>} />
        <Route path="/signup" element={<RequireGuest><SignupScreen /></RequireGuest>} />
        <Route path="/onboarding" element={<DriverOnboardingScreen />} />
        <Route path="/permissions" element={<PermissionRequestScreen />} />
        <Route path="/registration-success" element={<RegistrationSuccessScreen />} />
        <Route path="/approval-success" element={<ApprovalSuccessScreen />} />

        <Route
          path="/home"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="available" replace />} />
          <Route path="available" element={<AvailableTab />} />
          <Route path="active" element={<ActiveTab />} />
          <Route path="history" element={<HistoryTab />} />
          <Route path="profile" element={<ProfileTab />} />
          <Route path="wallet" element={<WalletScreen />} />
          <Route path="wallet/bank-details" element={<BankDetailsScreen />} />
          <Route path="notifications" element={<NotificationInboxScreen />} />
          <Route path="orders/:orderId" element={<OrderDetailsScreen />} />
        </Route>

        <Route path="/wallet" element={<Navigate to="/home/wallet" replace />} />
        <Route path="/notifications" element={<Navigate to="/home/notifications" replace />} />
        <Route path="/orders/:orderId" element={<LegacyOrderRedirect />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ToastHost />
      <DialogHost />

      {update && (
        <UpdateDialog
          version={update.version}
          status={update.status}
          onClose={() => setUpdate(null)}
        />
      )}
    </>
  );
};

export default App;
