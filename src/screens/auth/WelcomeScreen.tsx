import { useNavigate } from 'react-router-dom';
import { Bike } from 'lucide-react';
import { Button } from '../../components/ui/Button';

/** Port of lib/screens/auth/welcome_screen.dart. */
export const WelcomeScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="app-frame">
      <div className="auth-screen" style={{ paddingTop: 72 }}>
        <div>
          <div className="auth-logo auth-logo--green">Queless</div>
          <div className="auth-logo">Driver</div>
        </div>

        <p className="auth-tagline">
          Deliver with speed.
          <br />
          Get paid on time.
        </p>

        <div className="auth-illustration">
          <Bike size={100} strokeWidth={1.4} />
        </div>

        <div className="stack-sm">
          <Button variant="primary" block onClick={() => navigate('/login')}>
            Log in
          </Button>
          <Button variant="outline" block onClick={() => navigate('/signup')}>
            Create account
          </Button>
        </div>
      </div>
    </div>
  );
};
