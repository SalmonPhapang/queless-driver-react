import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

/** Port of lib/screens/auth/welcome_screen.dart. */
export const WelcomeScreen = () => {
  const { colors } = useTheme();

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.content}>
        <View style={styles.logoBlock}>
          <Text style={[styles.logo, { color: colors.success }]}>Queless</Text>
          <Text style={[styles.logo, { color: colors.accent }]}>Driver</Text>
        </View>

        <Text style={[styles.tagline, { color: colors.text }]}>
          {'Deliver with speed.\nGet paid on time.'}
        </Text>

        <View style={styles.illustration}>
          <MaterialCommunityIcons name="bike" size={100} color={colors.accent} />
        </View>

        <View style={styles.actions}>
          <Button title="Log in" variant="primary" block onPress={() => router.push('/login')} />
          <Button
            title="Create account"
            variant="outline"
            block
            onPress={() => router.push('/signup')}
          />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { flex: 1, paddingTop: 72, paddingHorizontal: 24, justifyContent: 'space-between' },
  logoBlock: { gap: 2 },
  logo: { ...typography.displayLarge, fontWeight: '800' },
  tagline: { ...typography.headlineMedium, lineHeight: 32, marginTop: 24 },
  illustration: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  actions: { gap: 12, paddingBottom: 32 },
});
