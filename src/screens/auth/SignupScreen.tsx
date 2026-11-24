import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar } from '../../components/ui/AppBar';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { errorMessage } from '../../lib/errors';
import { AuthService } from '../../services/authService';
import { UiService } from '../../services/uiService';

const EMAIL_RE = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

/** Port of lib/screens/auth/signup_screen.dart. */
export const SignupScreen = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const signup = async () => {
    const trimmed = email.trim();

    if (!trimmed) {
      UiService.showInfo('Please enter your email');
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      UiService.showInfo('Please enter a valid email address');
      return;
    }
    if (!password) {
      UiService.showInfo('Please enter a password');
      return;
    }
    if (password.length < 6) {
      UiService.showInfo('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      await AuthService.signUpWithEmail(trimmed, password);
      // RootRouter re-evaluates the whole gate once the session exists.
      navigate('/', { replace: true });
    } catch (error) {
      UiService.showError(`Signup failed: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-frame">
      <div className="screen">
        <AppBar title="Sign up" back onBack={() => navigate(-1)} />
        <div className="screen-body screen-body--pad-lg">
          <div style={{ maxWidth: 420, margin: '0 auto' }}>
            <h1 className="page-title">Create an account</h1>
            <p className="text-muted mt-8" style={{ fontSize: 16 }}>
              Start delivering and earning with Queless.
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
                autoComplete="new-password"
                placeholder="Choose a strong password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void signup();
                }}
              />
            </div>

            <Button
              variant="primary"
              block
              className="mt-32"
              loading={loading}
              onClick={() => void signup()}
            >
              Sign up
            </Button>

            <p className="text-muted text-center mt-24" style={{ fontSize: 12.5 }}>
              By signing up, you agree to our <strong className="text-primary">Terms &amp; Conditions</strong>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
