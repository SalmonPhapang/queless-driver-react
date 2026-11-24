import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Prefs, PrefKeys } from '../../lib/storage';

/** Port of lib/screens/auth/approval_success_screen.dart. */
export const ApprovalSuccessScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="app-frame">
      <div className="approval-screen">
        <div className="approval-screen__icon">
          <ShieldCheck size={84} strokeWidth={1.4} />
        </div>
        <h1 className="approval-screen__title">Profile Approved!</h1>
        <p className="approval-screen__text">
          Congratulations! Your driver profile has been verified by the Queless team.
        </p>
        <p className="approval-screen__text" style={{ fontSize: 15 }}>
          You are now ready to start receiving orders and earning with the family. Welcome aboard!
        </p>
        <Button
          variant="primary"
          onClick={() => {
            Prefs.setBool(PrefKeys.approvalWelcomeSeen, true);
            navigate('/home', { replace: true });
          }}
        >
          START EARNING
        </Button>
      </div>
    </div>
  );
};
