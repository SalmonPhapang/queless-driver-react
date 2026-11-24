import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Ban } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { StatusMessage } from '../components/ui/StatusMessage';
import { errorMessage } from '../lib/errors';
import { useAuthStore } from '../stores/authStore';
import { DriverService } from '../services/driverService';
import { AuthService } from '../services/authService';
import { UiService } from '../services/uiService';
import { Prefs, PrefKeys } from '../lib/storage';
import type { Driver } from '../models/driver';
import { DriverStatusX } from '../models/statuses';

/**
 * Port of `RootRouter` in lib/main.dart.
 *
 * Resolves the one place the driver is allowed to be right now. Every gate is
 * ordered exactly like the Flutter original: inactive account, missing
 * profile, unverified (registration + permissions), verified (approval +
 * permissions), then home.
 */
export const RootGate = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setDriver(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDriver(await DriverService.getDriverProfile(user.id));
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!initialized) {
    return (
      <div className="app-viewport">
        <div className="app-frame">
          <div className="loading-screen">
            <Spinner />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/welcome" replace />;

  if (loading) {
    return (
      <div className="app-viewport">
        <div className="app-frame">
          <div className="loading-screen">
            <Spinner />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-viewport">
        <div className="app-frame">
          <div className="centered-screen">
            <div style={{ color: 'var(--error)' }}>
              <Ban size={48} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800 }}>Error loading profile</h1>
            <p className="text-muted" style={{ fontSize: 14 }}>
              {error}
            </p>
            <Button variant="primary" onClick={() => void loadProfile()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (driver && driver.driverStatus === 'inactive') {
    return (
      <div className="app-viewport">
        <div className="app-frame">
          <div className="centered-screen">
            <div style={{ color: 'var(--error)' }}>
              <Ban size={80} strokeWidth={1.5} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>
              Account {DriverStatusX.displayName(driver.driverStatus)}
            </h1>
            <p className="text-muted" style={{ fontSize: 16, lineHeight: 1.55 }}>
              Your driver profile has been{' '}
              {DriverStatusX.displayName(driver.driverStatus).toLowerCase()}. You no longer have
              access to the platform.
            </p>
            {signOutError && (
              <StatusMessage
                variant="error"
                title="Could not sign out"
                message={signOutError}
                onDismiss={() => setSignOutError(null)}
              />
            )}
            <Button
              variant="outline"
              block
              className="mt-16"
              onClick={() => {
                setSignOutError(null);
                void AuthService.signOut()
                  .then(() => navigate('/welcome', { replace: true }))
                  .catch((signOutFailure) => {
                    setSignOutError(errorMessage(signOutFailure));
                    UiService.showError(`Could not sign out: ${errorMessage(signOutFailure)}`);
                  });
              }}
            >
              Log Out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // DB defaults full_name to '' NOT NULL, so check both null and empty.
  const needsOnboarding = driver == null || !driver.fullName || driver.fullName.trim() === '';
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  const registrationSuccessSeen = Prefs.getBool(PrefKeys.registrationSuccessSeen);
  const approvalWelcomeSeen = Prefs.getBool(PrefKeys.approvalWelcomeSeen);
  const permissionsRequested = Prefs.getBool(PrefKeys.permissionsRequested);

  if (!driver.isVerified) {
    if (!registrationSuccessSeen) return <Navigate to="/registration-success" replace />;
    if (!permissionsRequested) return <Navigate to="/permissions" replace />;
    return <Navigate to="/home" replace />;
  }

  if (!approvalWelcomeSeen) return <Navigate to="/approval-success" replace />;
  if (!permissionsRequested) return <Navigate to="/permissions" replace />;
  return <Navigate to="/home" replace />;
};
