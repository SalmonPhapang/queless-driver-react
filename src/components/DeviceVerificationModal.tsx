import { useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import type { DeviceBindingClient } from '../core/deviceBinding';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { Button } from './Button';

interface DeviceVerificationModalProps {
  client: DeviceBindingClient;
  onVerified: () => void;
}

/**
 * A challenge opened by sign-in outlives LoginScreen: as soon as the session
 * exists the guest gate redirects to RootGate. Keeping the pending challenge in
 * module state lets RootGate take over rendering it, so no gate can resolve —
 * and no route can be reached — while the SMS answer is still unresolved.
 */
export interface PendingDeviceChallenge {
  client: DeviceBindingClient;
  promise: Promise<boolean>;
  resolve: (ok: boolean) => void;
}

let pendingChallenge: PendingDeviceChallenge | null = null;
const listeners = new Set<() => void>();

const emitChallengeChange = () => {
  for (const listener of listeners) listener();
};

export const subscribeDeviceChallenge = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getPendingDeviceChallenge = (): PendingDeviceChallenge | null => pendingChallenge;

/** Open (or re-use) the forced challenge; resolves only after server approval. */
export const requestDeviceChallenge = (client: DeviceBindingClient): Promise<boolean> => {
  if (pendingChallenge) return pendingChallenge.promise;
  let resolve!: (ok: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  pendingChallenge = { client, promise, resolve };
  emitChallengeChange();
  return promise;
};

/** Only a successful `verifyCode` call is allowed to close the challenge. */
export const completeDeviceChallenge = (): void => {
  if (!pendingChallenge) return;
  const current = pendingChallenge;
  pendingChallenge = null;
  current.resolve(true);
  emitChallengeChange();
};

/**
 * Port of widgets/auth/device_verification_dialog.dart.
 *
 * The SMS challenge shown when a driver signs in on a phone the account has
 * not seen before. The code goes to the number on the account (resolved by the
 * server — the app never sees it), so a thief with the password but no SIM
 * cannot get in.
 *
 * This stays a forced modal rather than a `/verify-device` route: the challenge
 * is awaited between sign-in and navigation, so a signed-in but unverified
 * session can never deep-link past it into home. Backdrop, hardware back and
 * Cancel are all disabled; only a successful server verification closes it.
 */
export const DeviceVerificationModal = ({ client, onVerified }: DeviceVerificationModalProps) => {
  const { colors } = useTheme();
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
    // The initial SMS must be sent exactly once, like the web dialog's initState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
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
    <Modal visible transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[typography.titleLarge, styles.title, { color: colors.text }]}>
            Verify this phone
          </Text>
          <Text style={[typography.bodyMedium, styles.body, { color: colors.textMuted }]}>
            {
              'For your security, a driver account works from one phone at a time. We sent a code to the number on your account — enter it to make this your active phone.'
            }
          </Text>
          <TextInput
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="numeric"
            autoFocus
            placeholder="123456"
            maxLength={6}
            style={[
              typography.bodyMedium,
              styles.code,
              {
                color: colors.text,
                borderColor: colors.divider,
                backgroundColor: colors.background,
              },
            ]}
            placeholderTextColor={colors.subtext}
            onSubmitEditing={() => void verify()}
          />
          {error && (
            <Text style={[typography.bodySmall, styles.error, { color: colors.error }]}>
              {error}
            </Text>
          )}
          {resendIn > 0 && (
            <Text style={[typography.bodySmall, styles.hint, { color: colors.subtext }]}>
              {`You can request another code in ${resendIn} seconds`}
            </Text>
          )}
          <View style={styles.actions}>
            {resendIn === 0 && (
              <Button
                title="Resend code"
                variant="ghost"
                onPress={() => void send()}
                disabled={busy}
              />
            )}
            <Button
              title="Verify"
              variant="primary"
              onPress={() => void verify()}
              disabled={busy}
              loading={verifying}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 24, gap: 14 },
  title: { fontWeight: '700' },
  body: { lineHeight: 22 },
  code: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  error: { marginTop: -6 },
  hint: { marginTop: -6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 },
});
