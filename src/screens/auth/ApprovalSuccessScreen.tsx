import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { Prefs, PrefKeys } from '../../lib/storage';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

/** Port of lib/screens/auth/approval_success_screen.dart. */
export const ApprovalSuccessScreen = () => {
  const { colors } = useTheme();

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.screen}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="shield-check" size={84} color={colors.success} />
        </View>
        <Text style={[typography.headlineLarge, styles.title, { color: colors.text }]}>
          Profile Approved!
        </Text>
        <Text style={[typography.bodyLarge, styles.text, { color: colors.textMuted }]}>
          Congratulations! Your driver profile has been verified by the Queless team.
        </Text>
        <Text style={[typography.bodyLarge, styles.text, { color: colors.textMuted }]}>
          You are now ready to start receiving orders and earning with the family. Welcome aboard!
        </Text>
        <View style={styles.action}>
          <Button
            title="START EARNING"
            variant="primary"
            onPress={() => {
              Prefs.setBool(PrefKeys.approvalWelcomeSeen, true);
              // /home on the web resolves to its "available" index tab.
              router.replace('/home/available');
            }}
          />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  iconWrap: { marginBottom: 8 },
  title: { fontWeight: '800', textAlign: 'center' },
  text: { textAlign: 'center', lineHeight: 24 },
  action: { marginTop: 16 },
});
