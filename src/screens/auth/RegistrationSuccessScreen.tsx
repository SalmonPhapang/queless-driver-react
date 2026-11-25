import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Prefs, PrefKeys } from '../../lib/storage';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

/** Port of lib/screens/auth/registration_success_screen.dart. */
export const RegistrationSuccessScreen = () => {
  const { colors } = useTheme();

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.hero}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="check-circle" size={72} color={colors.success} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{'Welcome to the\nQueless Family!'}</Text>
        <Text style={[typography.bodyLarge, styles.body, { color: colors.textMuted }]}>
          Thank you for registering as a driver. Your profile is now being reviewed by our team.
        </Text>
        <Text style={[typography.bodyMedium, styles.body, { color: colors.textMuted }]}>
          You will start receiving orders once your profile has been verified. We will notify you
          as soon as you are cleared to start earning!
        </Text>
        <View style={styles.action}>
          <Button
            title="GOT IT"
            variant="primary"
            block
            onPress={() => {
              Prefs.setBool(PrefKeys.registrationSuccessSeen, true);
              // RootGate re-evaluates every gate after the flag is stored.
              router.replace('/');
            }}
          />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  iconWrap: { marginBottom: 8 },
  title: { ...typography.headlineLarge, fontSize: 28, fontWeight: '800', lineHeight: 36, textAlign: 'center' },
  body: { maxWidth: 400, lineHeight: 24, textAlign: 'center' },
  action: { width: '100%', maxWidth: 400, marginTop: 16 },
});
