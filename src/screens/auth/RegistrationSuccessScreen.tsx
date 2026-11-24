import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Prefs, PrefKeys } from '../../lib/storage';

/** Port of lib/screens/auth/registration_success_screen.dart. */
export const RegistrationSuccessScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="app-frame">
      <div className="screen">
        <div className="success-hero">
          <div className="success-hero__icon">
            <CheckCircle2 size={72} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.25 }}>
            Welcome to the
            <br />
            Queless Family!
          </h1>
          <p className="text-muted" style={{ fontSize: 16, lineHeight: 1.55, maxWidth: 400 }}>
            Thank you for registering as a driver. Your profile is now being reviewed by our team.
          </p>
          <p className="text-muted" style={{ fontSize: 14, lineHeight: 1.55, maxWidth: 400 }}>
            You will start receiving orders once your profile has been verified. We will notify you
            as soon as you are cleared to start earning!
          </p>
          <Button
            variant="primary"
            block
            className="mt-16"
            style={{ letterSpacing: '0.1em', minHeight: 58, fontSize: 16 }}
            onClick={() => {
              Prefs.setBool(PrefKeys.registrationSuccessSeen, true);
              navigate('/', { replace: true });
            }}
          >
            GOT IT
          </Button>
        </div>
      </div>
    </div>
  );
};
