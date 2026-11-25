import React from 'react';
import { Linking, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import type { AppVersion } from '../models/appVersion';

export type UpdateDialogStatus = 'none' | 'recommended' | 'forced';

interface UpdateDialogProps {
  version: AppVersion;
  status: UpdateDialogStatus;
  onClose: () => void;
}

const IOS_STORE_URL = 'https://apps.apple.com/app/queless-driver/id123456789';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.queless.driver';

/** Port of lib/widgets/update_dialog.dart. */
export const UpdateDialog = ({ version, status, onClose }: UpdateDialogProps) => {
  const { colors } = useTheme();
  const forced = status === 'forced';

  const openUpdate = () => {
    const fallback = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
    const url = version.downloadUrl ?? fallback;
    void WebBrowser.openBrowserAsync(url).catch(() => {
      void Linking.openURL(url).catch(() => undefined);
    });
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={forced ? () => undefined : onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.divider },
          ]}
        >
          <Text style={[typography.titleLarge, styles.title, { color: colors.text }]}>
            {forced ? 'Update Required' : 'Update Available'}
          </Text>

          <Text style={[typography.bodyMedium, styles.body, { color: colors.text }]}>
            {`A new version of the app is available (${version.version}).`}
          </Text>

          {version.releaseNotes ? (
            <View style={styles.notes}>
              <Text style={[typography.labelLarge, styles.notesTitle, { color: colors.text }]}>
                What's New:
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.text }]}>
                {version.releaseNotes}
              </Text>
            </View>
          ) : null}

          <Text style={[typography.bodyMedium, styles.body, { color: colors.textMuted }]}>
            {forced
              ? 'Please update to the latest version to continue using the app.'
              : 'We recommend updating to the latest version for the best experience.'}
          </Text>

          <View style={styles.actions}>
            {!forced && (
              <Button title="Later" variant="ghost" onPress={onClose} />
            )}
            <Button title="Update Now" variant="green" onPress={openUpdate} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  title: {
    marginBottom: 16,
  },
  body: {
    marginBottom: 12,
  },
  notes: {
    marginBottom: 12,
  },
  notesTitle: {
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
});
