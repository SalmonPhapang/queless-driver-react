import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppBar } from '../../components/AppBar';
import { Button } from '../../components/Button';
import { requestDeviceChallenge } from '../../components/DeviceVerificationModal';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { errorMessage } from '../../lib/errors';
import { AuthService } from '../../services/authService';
import { DeviceBindingService } from '../../services/deviceBindingService';
import { UiService } from '../../services/uiService';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

/**
 * Port of lib/screens/auth/login_screen.dart.
 *
 * The SMS device challenge is awaited between sign-in and navigation: a phone
 * this account has never seen must pass it before it is let in.
 */
export const LoginScreen = () => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // The challenge is forced (no Cancel / backdrop / hardware-back dismissal)
  // and is awaited here before navigation. A route would leave a signed-in but
  // unverified session able to deep-link straight into home. RootGate renders
  // the modal once the guest gate hands the new session over to it.
  const showDeviceChallenge = (): Promise<boolean> =>
    requestDeviceChallenge(DeviceBindingService.client);

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

      // RootGate re-evaluates every gate once the session exists.
      router.replace('/');
    } catch (error) {
      UiService.showError(`Login failed: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} contentContainerStyle={styles.body}>
      <AppBar title="Log in" onBack={() => router.back()} />
      <View style={styles.form}>
        <Text style={[typography.headlineMedium, styles.pageTitle, { color: colors.text }]}>
          Welcome back
        </Text>
        <Text style={[typography.bodyLarge, styles.subtitle, { color: colors.textMuted }]}>
          Enter your details to continue delivering.
        </Text>

        <View style={styles.fields}>
          <Input
            label="Email"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="email@example.com"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            secureTextEntry
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void login()}
          />
        </View>

        <Button
          title="Log in"
          variant="primary"
          block
          loading={loading}
          onPress={() => void login()}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { padding: 24, flexGrow: 1 },
  form: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  pageTitle: { fontWeight: '700' },
  subtitle: { marginTop: 8 },
  fields: { marginTop: 32, gap: 16 },
});
