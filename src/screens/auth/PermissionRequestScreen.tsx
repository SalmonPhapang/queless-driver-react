import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { PermissionRequestSkeleton } from '../../components/Skeleton';
import { AppConfig } from '../../config/appConfig';
import { errorMessage } from '../../lib/errors';
import { Prefs, PrefKeys } from '../../lib/storage';
import { AuthService } from '../../services/authService';
import { BatteryService } from '../../services/batteryService';
import { PushService } from '../../services/pushService';
import { UiService } from '../../services/uiService';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

type PermissionKind = 'location' | 'notifications' | 'camera' | 'photos' | 'battery';

interface PermissionState {
  location: boolean;
  notifications: boolean;
  camera: boolean;
  photos: boolean;
  battery: boolean;
}

interface TileProps {
  icon: ReactNode;
  title: string;
  description: string;
  granted: boolean;
  busy: boolean;
  onAllow: () => void;
}

const PermissionTile = ({ icon, title, description, granted, busy, onAllow }: TileProps) => {
  const { colors } = useTheme();
  return (
    <Card style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: colors.primaryContainer }]}>{icon}</View>
      <View style={styles.grow}>
        <Text style={[typography.titleSmall, styles.tileTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{description}</Text>
      </View>
      {granted ? (
        <MaterialCommunityIcons name="check-circle" size={24} color={colors.success} />
      ) : (
        <Button
          title={busy ? 'Requesting…' : 'Allow Access'}
          variant="primary"
          size="sm"
          onPress={onAllow}
          disabled={busy}
        />
      )}
    </Card>
  );
};

/**
 * Port of lib/screens/auth/permission_request_screen.dart: one tile per
 * permission, one OS prompt per tap, and Continue only once every required
 * tile is granted. Role-specific tiles keep the same staged pattern.
 */
export const PermissionRequestScreen = () => {
  const { colors } = useTheme();
  const [state, setState] = useState<PermissionState>({
    location: false,
    notifications: !AppConfig.remotePushAvailable,
    camera: false,
    photos: false,
    battery: false,
  });
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<PermissionKind | null>(null);

  // Battery optimisation is Android-only; iOS has no OS-level equivalent.
  const requiresBattery = Platform.OS === 'android';
  const allGranted = (value: PermissionState): boolean =>
    value.location &&
    value.notifications &&
    value.camera &&
    value.photos &&
    (!requiresBattery || value.battery);

  const proceed = async (snapshot: PermissionState = state) => {
    Prefs.setBool(PrefKeys.permissionsRequested, true);
    // This is the only screen that asks for notification access. Arm the token
    // silently here so an already-authorised driver does not need a second
    // prompt (or get pushed through the screen with no visible question).
    if (AppConfig.remotePushAvailable && snapshot.notifications) {
      await AuthService.syncFcmToken();
    }
    // Flutter pushes RootGate here so every gate is re-evaluated.
    router.replace('/');
  };

  useEffect(() => {
    void (async () => {
      try {
        let camera = false;
        let photos = false;
        try {
          camera = (await ImagePicker.getCameraPermissionsAsync()).granted;
          photos = (await ImagePicker.getMediaLibraryPermissionsAsync()).granted;
        } catch (error) {
          console.debug('Could not read gallery permission state:', error);
        }

        const next: PermissionState = {
          location: (await Location.getForegroundPermissionsAsync()).status === 'granted',
          notifications: await PushService.isAuthorized(),
          camera,
          photos,
          battery: await BatteryService.isExempted(),
        };
        setState(next);
        setLoading(false);
        // Like Flutter, skip the screen when everything is already granted.
        if (allGranted(next)) await proceed(next);
      } catch (error) {
        setLoading(false);
        UiService.showError(`Error checking permissions: ${errorMessage(error)}`);
      }
    })();
    // The initial probe must run once, exactly like initState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = async (kind: PermissionKind) => {
    setRequesting(kind);
    try {
      let granted = false;
      switch (kind) {
        case 'location':
          granted = (await Location.requestForegroundPermissionsAsync()).status === 'granted';
          break;
        case 'notifications':
          granted = await PushService.requestPermission();
          if (granted && AppConfig.remotePushAvailable) await AuthService.syncFcmToken();
          break;
        case 'camera':
          granted = (await ImagePicker.requestCameraPermissionsAsync()).granted;
          break;
        case 'photos':
          granted = (await ImagePicker.requestMediaLibraryPermissionsAsync()).granted;
          break;
        case 'battery':
          // iOS has no battery-optimisation exemption to grant. On Android the
          // settings screen is opened, then BatteryService persists the flag.
          if (Platform.OS === 'android') {
            await BatteryService.openBatterySettings();
            granted = await BatteryService.requestExemption();
          } else {
            granted = await BatteryService.showExemptionDialog();
          }
          break;
      }

      const next = { ...state, [kind]: granted };
      setState(next);
      if (allGranted(next)) await proceed(next);
    } catch (error) {
      console.debug(`${kind} permission was not granted:`, error);
    } finally {
      setRequesting(null);
    }
  };

  if (loading) {
    return <PermissionRequestSkeleton />;
  }

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[typography.headlineLarge, styles.title, { color: colors.accent }]}>
          Help us serve you better
        </Text>
        <Text style={[typography.bodyLarge, styles.subtitle, { color: colors.textMuted }]}>
          To provide the best delivery experience, we need a few permissions.
        </Text>

        <View style={styles.tiles}>
          <PermissionTile
            icon={<MaterialCommunityIcons name="map-marker" size={22} color={colors.accent} />}
            title="Location Access"
            description="We use your location to find nearby stores and track your delivery in real-time."
            granted={state.location}
            busy={requesting === 'location'}
            onAllow={() => void request('location')}
          />
          <PermissionTile
            icon={<MaterialCommunityIcons name="camera" size={22} color={colors.accent} />}
            title="Camera Access"
            description="Required for capturing your profile photo and scanning documents."
            granted={state.camera}
            busy={requesting === 'camera'}
            onAllow={() => void request('camera')}
          />
          <PermissionTile
            icon={<MaterialCommunityIcons name="image" size={22} color={colors.accent} />}
            title="Photo Gallery Access"
            description="Required for uploading your profile picture from your device."
            granted={state.photos}
            busy={requesting === 'photos'}
            onAllow={() => void request('photos')}
          />
          {AppConfig.remotePushAvailable && (
            <PermissionTile
              icon={<MaterialCommunityIcons name="bell-ring" size={22} color={colors.accent} />}
              title="Notifications"
              description="Get real-time updates about new orders, delivery status, and important alerts."
              granted={state.notifications}
              busy={requesting === 'notifications'}
              onAllow={() => void request('notifications')}
            />
          )}
          {requiresBattery && state.location && (
            <PermissionTile
              icon={<MaterialCommunityIcons name="battery-charging" size={22} color={colors.accent} />}
              title="Battery Optimisation"
              description="Allow Queless to run in the background so your location stays live when using other apps like Google Maps."
              granted={state.battery}
              busy={requesting === 'battery'}
              onAllow={() => void request('battery')}
            />
          )}
        </View>

        <View style={styles.actions}>
          <Button
            title="Continue"
            variant="primary"
            block
            onPress={() => void proceed()}
            disabled={!allGranted(state) || requesting !== null}
          />
          <Button
            title="Skip for now"
            variant="ghost"
            size="sm"
            onPress={() => void proceed()}
            disabled={requesting !== null}
          />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { marginTop: 12, lineHeight: 24 },
  tiles: { marginTop: 32, gap: 12 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontWeight: '700' },
  grow: { flex: 1 },
  actions: { gap: 8, marginTop: 32 },
  body: { paddingTop: 56, paddingBottom: 32, paddingHorizontal: 24, flexGrow: 1 },
});
