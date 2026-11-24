import { useEffect, useRef, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TextField } from './ui/Field';
import { Spinner } from './ui/Spinner';
import type { DeviceBindingClient } from '../core/deviceBinding';

interface DeviceVerificationDialogProps {
  client: DeviceBindingClient;
  onVerified: () => void;
}

/**
 * Port of widgets/auth/device_verification_dialog.dart.
 *
 * The SMS challenge shown when a driver signs in on a phone the account has
 * not seen before. The code goes to the number on the account (resolved by the
 * server — the app never sees it), so a thief with the password but no SIM
 * cannot get in.
 *
 * This stays a forced dialog rather than a `/verify-device` route: the challenge
 * is awaited between sign-in and navigation, so a signed-in but unverified
 * session can never deep-link past it into /home. Backdrop, Escape and Cancel
 * are all disabled; only a successful server verification closes it.
 */
export const DeviceVerificationDialog = ({
  client,
  onVerified,
}: DeviceVerificationDialogProps) => {
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const startCooldown = (seconds: number) => {
    setResendIn(seconds);
  };

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await client.sendVerificationCode();
      if (result.sent) {
        startCooldown(result.retryAfterSeconds ?? 60);
        return;
      }
      if (result.retryAfterSeconds != null) {
        startCooldown(result.retryAfterSeconds);
        setError(result.message ?? 'Please wait before requesting a new code.');
        return;
      }
      setError(result.message ?? 'We could not send the code. Please try again.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => {
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn > 0]);

  const verify = async () => {
    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setError('Enter the 6-digit code we sent you.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const result = await client.verifyCode(trimmed);
      if (result.status === 'verified') {
        onVerified();
        return;
      }
      setError(result.message ?? 'That code is not correct. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const busy = sending || verifying;

  return (
    <Modal
      dismissible={false}
      title="Verify this phone"
      actions={
        <>
          {resendIn === 0 && (
            <Button variant="ghost" onClick={() => void send()} disabled={busy}>
              Resend code
            </Button>
          )}
          <Button variant="primary" onClick={() => void verify()} disabled={busy}>
            {verifying ? <Spinner size="sm" light /> : 'Verify'}
          </Button>
        </>
      }
    >
      <p>
        For your security, a driver account works from one phone at a time. We sent a code to the
        number on your account — enter it to make this your active phone.
      </p>
      <TextField
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoFocus
        placeholder="123456"
        maxLength={6}
        style={{ textAlign: 'center', fontSize: 22, letterSpacing: 10, fontWeight: 600 }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void verify();
        }}
      />
      {error && <p className="field__error">{error}</p>}
      {resendIn > 0 && (
        <p className="field__hint">You can request another code in {resendIn} seconds</p>
      )}
    </Modal>
  );
};
