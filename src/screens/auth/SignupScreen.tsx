import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppBar } from '../../components/AppBar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { errorMessage } from '../../lib/errors';
import { AuthService } from '../../services/authService';
import { UiService } from '../../services/uiService';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

const EMAIL_RE = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

/** Port of lib/screens/auth/signup_screen.dart. */
export const SignupScreen = () => {
  const { colors } = useTheme();
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
      // RootGate re-evaluates the whole gate once the session exists.
      router.replace('/');
    } catch (error) {
      UiService.showError(`Signup failed: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false} contentContainerStyle={styles.body}>
      <AppBar title="Sign up" onBack={() => router.back()} />
      <View style={styles.form}>
        <Text style={[typography.headlineMedium, styles.pageTitle, { color: colors.text }]}>
          Create an account
        </Text>
        <Text style={[typography.bodyLarge, styles.subtitle, { color: colors.textMuted }]}>
          Start delivering and earning with Queless.
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
            autoComplete="new-password"
            placeholder="Choose a strong password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={() => void signup()}
          />
        </View>

        <Button
          title="Sign up"
          variant="primary"
          block
          loading={loading}
          onPress={() => void signup()}
        />

        <Text style={[styles.terms, { color: colors.textMuted }]}>
          {'By signing up, you agree to our '}
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Terms & Conditions</Text>
        </Text>
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
  terms: { ...typography.bodySmall, fontSize: 12.5, textAlign: 'center', marginTop: 24 },
});
