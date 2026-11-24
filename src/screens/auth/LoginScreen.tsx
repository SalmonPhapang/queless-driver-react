import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar } from '../../components/ui/AppBar';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { DeviceVerificationDialog } from '../../components/DeviceVerificationDialog';
import { errorMessage } from '../../lib/errors';
import { AuthService } from '../../services/authService';
import { DeviceBindingService } from '../../services/deviceBindingService';
import { UiService } from '../../services/uiService';

/**
 * Port of lib/screens/auth/login_screen.dart.
 *
 * The SMS device challenge is awaited between sign-in and navigation: a phone
 * this account has never seen must pass it before it is let in.
 */
export const LoginScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const challengeResolver = useRef<((ok: boolean) => void) | null>(null);

  // The challenge is forced (no Cancel / backdrop / Escape dismissal) and is
  // awaited here before navigation. A route would leave a signed-in but
  // unverified session able to deep-link straight into /home.
  const showDeviceChallenge = (): Promise<boolean> =>
    new Promise((resolve) => {
      challengeResolver.current = resolve;
      setChallengeOpen(true);
    });

  const finishChallenge = () => {
    setChallengeOpen(false);
    challengeResolver.current?.(true);
    challengeResolver.current = null;
  };

  const login = async () => {
    if (!email || !password) {
      UiService.showInfo('Please enter your email and password');
      return;
    }

    setLoading(true);
    try {
      await AuthService.signInWithEmail(email.trim(), password);

      // One driver account, one phone. A handset this account has never seen
      // (a replacement, or a lost phone someone else is holding) has to pass
      // the SMS challenge right here, before it is let in.
      const binding = await DeviceBindingService.ensureVerified(showDeviceChallenge);
      if (!binding.ok) {
        let signOutError: string | null = null;
        try {
          await AuthService.signOut();
        } catch (error) {
          signOutError = errorMessage(error);
        }
        UiService.showError(
          signOutError ? `${binding.message} Sign-out also failed: ${signOutError}` : binding.message,
        );
        return;
      }

      navigate('/', { replace: true });
    } catch (error) {
      UiService.showError(`Login failed: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-frame">
      <div className="screen">
        <AppBar title="Log in" back onBack={() => navigate(-1)} />
        <div className="screen-body screen-body--pad-lg">
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <h1 className="page-title">Welcome back</h1>
            <p className="text-muted mt-8" style={{ fontSize: 16 }}>
              Enter your details to continue delivering.
            </p>

            <div className="stack mt-32">
              <TextField
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void login();
                }}
              />
            </div>

            <Button
              variant="primary"
              block
              className="mt-32"
              loading={loading}
              onClick={() => void login()}
            >
              Log in
            </Button>
          </div>
        </div>
      </div>

      {challengeOpen && (
        <DeviceVerificationDialog
          client={DeviceBindingService.client}
          onVerified={() => finishChallenge()}
        />
      )}
    </div>
  );
};
