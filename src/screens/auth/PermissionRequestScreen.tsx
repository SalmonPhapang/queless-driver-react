import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, BatteryFull, Camera, CheckCircle2, Image, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { AppConfig } from '../../config/appConfig';
import { AuthService } from '../../services/authService';
import { BatteryService } from '../../services/batteryService';
import { LocationService } from '../../services/locationService';
import { errorMessage } from '../../lib/errors';
import { Prefs, PrefKeys } from '../../lib/storage';
import { PushService } from '../../services/pushService';
import { UiService } from '../../services/uiService';

interface TileProps {
  icon: ReactNode;
  title: string;
  description: string;
  granted: boolean;
  onAllow: () => void;
}

const PermissionTile = ({ icon, title, description, granted, onAllow }: TileProps) => (
  <div className={`permission-tile${granted ? ' permission-tile--granted' : ''}`}>
    <div className="permission-tile__icon">{icon}</div>
    <div className="grow">
      <div className="permission-tile__title">{title}</div>
      <p className="permission-tile__text">{description}</p>
    </div>
    {granted ? (
      <span className="permission-tile__status">
        <CheckCircle2 size={24} />
      </span>
    ) : (
      <Button variant="primary" size="sm" pill onClick={onAllow} style={{ minHeight: 36 }}>
        Allow
      </Button>
    )}
  </div>
);

/** Port of lib/screens/auth/permission_request_screen.dart. */
export const PermissionRequestScreen = () => {
  const navigate = useNavigate();
  const [locationGranted, setLocationGranted] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(!AppConfig.featureFirebase);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [photosGranted, setPhotosGranted] = useState(false);
  const [batteryGranted, setBatteryGranted] = useState(false);
  const [loading, setLoading] = useState(true);

  const proceed = () => {
    Prefs.setBool(PrefKeys.permissionsRequested, true);
    // Flutter pushes RootRouter here so every gate is re-evaluated.
    navigate('/', { replace: true });
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
        const location = await LocationService.hasPermission();
        const notifications = AppConfig.featureFirebase
          ? (await PushService.notificationSettings()) === 'authorized'
          : true;
        const battery = await BatteryService.isExempted();

        // Browsers expose no queryable camera grant; the tile starts as
        // "not granted" until the driver allows it (native parity).
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
    const granted = await LocationService.requestPermission();
    setLocationGranted(granted);
    checkAndProceed({ location: granted });
  };

  const requestNotifications = async () => {
    if (!AppConfig.featureFirebase) {
      setNotificationsGranted(true);
      checkAndProceed({ notifications: true });
      return;
    }
    const granted = await PushService.requestPermission();
    setNotificationsGranted(granted);
    if (granted) await AuthService.syncFcmToken();
    checkAndProceed({ notifications: granted });
  };

  const requestCamera = async () => {
    let granted = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      granted = true;
    } catch (error) {
      console.debug('Camera permission was not granted:', error);
    }
    setCameraGranted(granted);
    checkAndProceed({ camera: granted });
  };

  const requestPhotos = async () => {
    // A file input needs no separate grant in the browser; opening one is the
    // closest equivalent to the native photo-library prompt.
    setPhotosGranted(true);
    checkAndProceed({ photos: true });
  };

  const requestBattery = async () => {
    const granted = await BatteryService.showExemptionDialog();
    setBatteryGranted(granted);
    checkAndProceed({ battery: granted });
  };

  if (loading) {
    return (
      <div className="app-frame">
        <div className="loading-screen">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <div className="screen">
        <div className="screen-body screen-body--pad-lg" style={{ paddingTop: 56, paddingBottom: 32 }}>
          <h1 className="page-title text-primary" style={{ fontSize: 28 }}>
            Help us serve you better
          </h1>
          <p className="text-muted mt-12" style={{ fontSize: 16, lineHeight: 1.5 }}>
            To provide the best delivery experience, we need a few permissions.
          </p>

          <div className="stack mt-32">
            <PermissionTile
              icon={<MapPin size={22} />}
              title="Location Access"
              description="We use your location to find nearby stores and track your delivery in real-time."
              granted={locationGranted}
              onAllow={() => void requestLocation()}
            />
            <PermissionTile
              icon={<Camera size={22} />}
              title="Camera Access"
              description="Required for capturing your profile photo and scanning documents."
              granted={cameraGranted}
              onAllow={() => void requestCamera()}
            />
            <PermissionTile
              icon={<Image size={22} />}
              title="Photo Gallery Access"
              description="Required for uploading your profile picture from your device."
              granted={photosGranted}
              onAllow={() => void requestPhotos()}
            />
            {AppConfig.featureFirebase && (
              <PermissionTile
                icon={<BellRing size={22} />}
                title="Notifications"
                description="Get real-time updates about new orders, delivery status, and important alerts."
                granted={notificationsGranted}
                onAllow={() => void requestNotifications()}
              />
            )}
            {locationGranted && (
              <PermissionTile
                icon={<BatteryFull size={22} />}
                title="Battery Optimisation"
                description="Allow Queless to run in the background so your location stays live when using other apps like Google Maps."
                granted={batteryGranted}
                onAllow={() => void requestBattery()}
              />
            )}
          </div>

          <div className="center mt-32">
            <button type="button" className="btn btn--ghost btn--sm" onClick={proceed}>
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
