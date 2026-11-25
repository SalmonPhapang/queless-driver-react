import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { Spinner } from '../../components/Spinner';
import { AppConfig } from '../../config/appConfig';
import { errorMessage } from '../../lib/errors';
import { Prefs, PrefKeys } from '../../lib/storage';
import { AuthService } from '../../services/authService';
import { BatteryService } from '../../services/batteryService';
import { UiService } from '../../services/uiService';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

interface TileProps {
  icon: ReactNode;
  title: string;
  description: string;
  granted: boolean;
  onAllow: () => void;
}

const PermissionTile = ({ icon, title, description, granted, onAllow }: TileProps) => {
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
        <Button title="Allow" variant="primary" size="sm" onPress={onAllow} />
      )}
    </Card>
  );
};

/** Port of lib/screens/auth/permission_request_screen.dart. */
export const PermissionRequestScreen = () => {
  const { colors } = useTheme();
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(!AppConfig.featureFirebase);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [photosGranted, setPhotosGranted] = useState(false);
  const [batteryGranted, setBatteryGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  const proceed = () => {
    Prefs.setBool(PrefKeys.permissionsRequested, true);
    // Flutter pushes RootRouter here so every gate is re-evaluated.
    router.replace('/');
  };

  const allGranted = (state: {
    location: boolean;
    notifications: boolean;
    camera: boolean;
    photos: boolean;
    battery: boolean;
  }): boolean =>
    state.location && state.notifications && state.camera && state.photos && state.battery;

  useEffect(() => {
    void (async () => {
      try {
        const location = (await Location.getForegroundPermissionsAsync()).status === 'granted';
        const notifications = AppConfig.featureFirebase
          ? (await Notifications.getPermissionsAsync()).status === 'granted'
          : true;
        const battery = await BatteryService.isExempted();

        // Camera and photo tiles start as "not granted" until the driver taps
        // Allow, matching the web port and the Flutter screen's initState.
        setLocationGranted(location);
        setNotificationsGranted(notifications);
        setBatteryGranted(battery);
        setLoading(false);

        if (
          allGranted({
            location,
            notifications,
            camera: false,
            photos: false,
            battery,
          })
        ) {
          proceed();
        }
      } catch (error) {
        setLoading(false);
        UiService.showError(`Error checking permissions: ${errorMessage(error)}`);
      }
    })();
    // The initial probe must run once, exactly like initState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAndProceed = (next: {
    location?: boolean;
    notifications?: boolean;
    camera?: boolean;
    photos?: boolean;
    battery?: boolean;
  }) => {
    if (
      allGranted({
        location: next.location ?? locationGranted,
        notifications: next.notifications ?? notificationsGranted,
        camera: next.camera ?? cameraGranted,
        photos: next.photos ?? photosGranted,
        battery: next.battery ?? batteryGranted,
      })
    ) {
      proceed();
    }
  };

  const requestLocation = async () => {
    const result = await Location.requestForegroundPermissionsAsync();
    const granted = result.status === 'granted';
    setLocationGranted(granted);
    checkAndProceed({ location: granted });
  };

  const requestNotifications = async () => {
    if (!AppConfig.featureFirebase) {
      setNotificationsGranted(true);
      checkAndProceed({ notifications: true });
      return;
    }
    const result = await Notifications.requestPermissionsAsync();
    const granted = result.status === 'granted';
    setNotificationsGranted(granted);
    if (granted) await AuthService.syncFcmToken();
    checkAndProceed({ notifications: granted });
  };

  const requestCamera = async () => {
    let granted = false;
    try {
      granted = (await ImagePicker.requestCameraPermissionsAsync()).granted;
    } catch (error) {
      console.debug('Camera permission was not granted:', error);
    }
    setCameraGranted(granted);
    checkAndProceed({ camera: granted });
  };

  const requestPhotos = async () => {
    let granted = false;
    try {
      granted = (await ImagePicker.requestMediaLibraryPermissionsAsync()).granted;
    } catch (error) {
      console.debug('Photo library permission was not granted:', error);
    }
    setPhotosGranted(granted);
    checkAndProceed({ photos: granted });
  };

  const requestBattery = async () => {
    let granted = false;
    try {
      // iOS has no battery-optimisation exemption to grant. On Android the
      // settings screen is opened, then BatteryService persists the flag.
      if (Platform.OS === 'android') {
        await BatteryService.openBatterySettings();
        granted = await BatteryService.requestExemption();
      } else {
        granted = await BatteryService.showExemptionDialog();
      }
    } catch (error) {
      console.debug('Battery exemption dialog failed:', error);
    }
    setBatteryGranted(granted);
    checkAndProceed({ battery: granted });
  };

  if (loading) {
    return (
      <Screen scroll={false} padded={false}>
        <View style={styles.loading}>
          <Spinner />
        </View>
      </Screen>
    );
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
            granted={locationGranted}
            onAllow={() => void requestLocation()}
          />
          <PermissionTile
            icon={<MaterialCommunityIcons name="camera" size={22} color={colors.accent} />}
            title="Camera Access"
            description="Required for capturing your profile photo and scanning documents."
            granted={cameraGranted}
            onAllow={() => void requestCamera()}
          />
          <PermissionTile
            icon={<MaterialCommunityIcons name="image" size={22} color={colors.accent} />}
            title="Photo Gallery Access"
            description="Required for uploading your profile picture from your device."
            granted={photosGranted}
            onAllow={() => void requestPhotos()}
          />
          {AppConfig.featureFirebase && (
            <PermissionTile
              icon={<MaterialCommunityIcons name="bell-ring" size={22} color={colors.accent} />}
              title="Notifications"
              description="Get real-time updates about new orders, delivery status, and important alerts."
              granted={notificationsGranted}
              onAllow={() => void requestNotifications()}
            />
          )}
          {locationGranted && (
            <PermissionTile
              icon={<MaterialCommunityIcons name="battery-charging" size={22} color={colors.accent} />}
              title="Battery Optimisation"
              description="Allow Queless to run in the background so your location stays live when using other apps like Google Maps."
              granted={batteryGranted}
              onAllow={() => void requestBattery()}
            />
          )}
        </View>

        <View style={styles.skip}>
          <Button title="Skip for now" variant="ghost" size="sm" onPress={proceed} />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingTop: 56, paddingBottom: 32, paddingHorizontal: 24, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { marginTop: 12, lineHeight: 24 },
  tiles: { marginTop: 32, gap: 12 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontWeight: '700' },
  grow: { flex: 1 },
  skip: { alignItems: 'center', marginTop: 32 },
});
