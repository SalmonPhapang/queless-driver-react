import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Camera,
  Car,
  ChevronRight,
  Clock,
  CreditCard,
  Image as ImageIcon,
  LogOut,
  Pencil,
  Phone,
  RefreshCw,
  SunMoon,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { IconButton } from '../../components/ui/IconButton';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { Switch } from '../../components/ui/Switch';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { formatCurrency } from '../../lib/format';
import type { Driver } from '../../models/driver';
import { AuthService } from '../../services/authService';
import { DriverService } from '../../services/driverService';
import { PayoutService } from '../../services/payoutService';
import { ShorebirdService } from '../../services/shorebirdService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import type { ThemeMode } from '../../stores/themeStore';
import './profile.css';

/** The service areas offered by the Dart location dropdown, in order. */
const LOCATIONS = [
  'Sebokeng',
  'Vereeniging',
  'Evaton',
  'Lakeside',
  'Vanderbijlpark',
  'Three Rivers',
  'Sharpeville',
] as const;

/** `ThemeMode.values` order in Flutter: system, light, dark. */
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

interface FormErrors {
  fullName?: string;
  idNumber?: string;
  contactNumber?: string;
  location?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
}

const themeModeText = (mode: ThemeMode): string => {
  switch (mode) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default:
      return 'System';
  }
};

/**
 * `image_picker` with maxWidth/maxHeight 1000 and imageQuality 85 has no direct
 * web equivalent. A canvas does the same resize/JPEG compression before upload.
 */
const prepareImage = async (file: File): Promise<File> => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return file;
    }
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, '') || 'profile';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch (error) {
    console.debug('Image preparation failed, uploading the original:', error);
    return file;
  }
};

/**
 * Port of lib/screens/home/tabs/profile_tab.dart.
 *
 * Renders inside the home shell's <Outlet/>, so it owns no app bar: the shell
 * keeps the notification badge and bottom navigation while this content
 * scrolls in `.screen-body`.
 */
export const ProfileTab = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [patchNumber, setPatchNumber] = useState<number | null>(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const previewUrl = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const driverProfile = await DriverService.getDriverProfile(user.id);
      // Align with the settlement-based wallet: use Paystack settlement data
      // (all-time) instead of the local driver_payments sum.
      const settlement = await PayoutService.getSettlementData(user.id);
      const patch = await ShorebirdService.getCurrentPatch();

      if (!alive.current) return;

      setDriver(driverProfile);
      setWalletBalance(settlement.total_earned ?? 0);
      setPatchNumber(patch?.number ?? null);
      if (driverProfile) {
        setFullName(driverProfile.fullName ?? '');
        setContactNumber(driverProfile.contactNumber ?? '');
        setVehicleMake(driverProfile.vehicleMake ?? '');
        setVehicleModel(driverProfile.vehicleModel ?? '');
        setVehicleColor(driverProfile.vehicleColor ?? '');
        setVehiclePlate(driverProfile.vehiclePlate ?? '');
        setIdNumber(driverProfile.idNumber ?? '');
        setSelectedLocation(driverProfile.location ?? null);
      }
      setLoading(false);
    } catch (error) {
      if (!alive.current) return;
      setLoading(false);
      UiService.showError(`Failed to load profile: ${errorMessage(error)}`);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const uploadImage = async (file: File) => {
    if (!user) return;
    try {
      const imageUrl = await DriverService.uploadProfileImage(user.id, file);
      // saveProfile now only updates image_url (other fields preserved via
      // null-safe upsert).
      await DriverService.saveProfile({ id: user.id, imageUrl });
      if (!alive.current) return;
      UiService.showSuccess('Profile photo updated');
      void loadProfile(); // Refresh profile
    } catch (error) {
      if (!alive.current) return;
      UiService.showError(`Failed to upload image: ${errorMessage(error)}`);
    }
  };

  const onFilePicked = async (file: File | undefined) => {
    if (!file) return;
    try {
      const prepared = await prepareImage(file);
      if (!alive.current) return;
      const nextPreview = URL.createObjectURL(prepared);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = nextPreview;
      setImagePreview(nextPreview);
      await uploadImage(prepared);
    } catch (error) {
      if (!alive.current) return;
      UiService.showError(`Error picking image: ${errorMessage(error)}`);
    }
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!fullName) next.fullName = 'Name required';

    if (!idNumber) next.idNumber = 'ID number required';
    else if (idNumber.length !== 13) next.idNumber = 'Must be exactly 13 digits';
    else if (!/^[0-9]+$/.test(idNumber)) next.idNumber = 'Must contain only digits';

    if (!contactNumber) next.contactNumber = 'Phone required';
    else {
      // Basic SA phone format check: local (e.g. 082...) or intl (+27...)
      const digitsOnly = contactNumber.replace(/[^0-9+]/g, '');
      if (digitsOnly.length < 10) next.contactNumber = 'Enter a valid phone number';
    }

    if (selectedLocation == null) next.location = 'Location required';

    if (!vehicleMake) next.vehicleMake = 'Required';
    if (!vehicleModel) next.vehicleModel = 'Required';
    if (!vehicleColor) next.vehicleColor = 'Required';
    if (!vehiclePlate) next.vehiclePlate = 'Required';

    return next;
  };

  const saveProfile = async () => {
    if (isSaving) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!user) return;

    // Extra safety: ensure all required fields are non-empty before API call.
    const name = fullName.trim();
    const phone = contactNumber.trim();
    const id = idNumber.trim();
    const make = vehicleMake.trim();
    const model = vehicleModel.trim();
    const color = vehicleColor.trim();
    const plate = vehiclePlate.trim();
    const location = selectedLocation;

    if (
      !name ||
      !phone ||
      !id ||
      !make ||
      !model ||
      !color ||
      !plate ||
      !location
    ) {
      UiService.showError('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      await DriverService.saveProfile({
        id: user.id,
        fullName: name,
        contactNumber: phone,
        idNumber: id,
        vehicleMake: make,
        vehicleModel: model,
        vehicleColor: color,
        vehiclePlate: plate,
        location,
        resetVerification: true, // Verification reset after change
      });

      if (!alive.current) return;
      setIsEditing(false);
      setErrors({});
      UiService.showSuccess('Profile updated. Re-verification required.');
      // Reset auth state to trigger re-verification check if needed.
      await AuthService.refreshUser();
    } catch (error) {
      if (!alive.current) return;
      UiService.showError(`Update failed: ${errorMessage(error)}`);
    } finally {
      if (alive.current) setIsSaving(false);
    }
  };

  const toggleOnlineStatus = async (isOnline: boolean) => {
    if (!user) return;
    try {
      await DriverService.updateOnlineStatus(user.id, isOnline);
      void loadProfile();
    } catch (error) {
      if (!alive.current) return;
      UiService.showError(`Status update failed: ${errorMessage(error)}`);
    }
  };

  const downloadShorebirdUpdate = async () => {
    UiService.showLoading('Downloading update...');
    try {
      await ShorebirdService.update();
      if (!alive.current) return;
      UiService.hideSnackBar();
      UiService.showSuccess('Update ready! Please restart the app to apply.');
      // Refresh patch info
      const patch = await ShorebirdService.getCurrentPatch();
      if (alive.current) setPatchNumber(patch?.number ?? null);
    } catch (error) {
      if (!alive.current) return;
      UiService.hideSnackBar();
      UiService.showError(`Download failed: ${errorMessage(error)}`);
    }
  };

  const showDownloadUpdateDialog = () => {
    setUpdateDialogOpen(true);
  };

  const checkShorebirdUpdates = async () => {
    if (isCheckingForUpdates) return;

    if (!ShorebirdService.isAvailable) {
      UiService.showInfo(ShorebirdService.unavailabilityReason);
      return;
    }

    setIsCheckingForUpdates(true);
    try {
      const status = await ShorebirdService.checkForUpdate();
      if (!alive.current) return;

      switch (status) {
        case 'upToDate':
          UiService.showInfo('You are up to date!');
          break;
        case 'outdated':
          showDownloadUpdateDialog();
          break;
        case 'restartRequired':
          UiService.showInfo('Update ready! Please restart the app to apply.');
          break;
        case 'unavailable':
          UiService.showError(
            ShorebirdService.unavailabilityReason || 'Shorebird update service is unavailable.',
          );
          break;
      }
    } catch (error) {
      if (!alive.current) return;
      UiService.showError(`Error checking for update: ${errorMessage(error)}`);
    } finally {
      if (alive.current) setIsCheckingForUpdates(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <Spinner />
      </div>
    );
  }

  const isOnline = driver?.driverStatus === 'online';
  const isVerified = driver?.isVerified === true;

  return (
    <div className="profile-tab">
      <div className="profile-hero">
        <button
          type="button"
          className="profile-avatar-btn"
          aria-label="Change profile photo"
          onClick={() => setPickerOpen(true)}
        >
          <Avatar
            src={imagePreview ?? driver?.imageUrl}
            name={driver?.fullName ?? user?.email ?? 'Driver'}
            size="lg"
          />
          <span className="avatar-edit">
            <Camera size={16} />
          </span>
        </button>

        <div className="grow">
          <div className="profile-hero__name">{driver?.fullName ?? 'Driver Name'}</div>
          <div className="profile-hero__email">{user?.email ?? ''}</div>

          <div className="profile-badges">
            <Badge tone={isOnline ? 'green' : 'red'}>
              <span
                className="profile-status-dot"
                style={{ background: isOnline ? 'var(--success)' : 'var(--error)' }}
              />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Badge>
            <Badge tone={isVerified ? 'blue' : 'orange'}>
              {isVerified ? <BadgeCheck size={12} /> : <Clock size={12} />}
              {isVerified ? 'VERIFIED' : 'UNVERIFIED'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="section-title profile-section-title mt-32">DRIVER STATUS</div>
      <div className="availability-card">
        <span
          className={cn('availability-card__icon', isOnline && 'availability-card__icon--on')}
        >
          <Zap size={22} />
        </span>
        <div className="grow">
          <div className="label">Available for Orders</div>
          <div className="text-xs text-muted profile-availability-copy">
            {isOnline
              ? 'You are currently visible to customers'
              : 'Turn on to start receiving orders'}
          </div>
        </div>
        <Switch
          checked={isOnline}
          onChange={(checked) => void toggleOnlineStatus(checked)}
          label="Available for Orders"
        />
      </div>

      <button
        type="button"
        className="earnings-card mt-24"
        onClick={() => navigate('/home/wallet')}
      >
        <span className="earnings-card__icon">
          <Wallet size={24} />
        </span>
        <span className="grow">
          <span className="earnings-card__label" style={{ display: 'block' }}>
            Total Earnings
          </span>
          <span className="earnings-card__amount" style={{ display: 'block' }}>
            {formatCurrency(walletBalance)}
          </span>
        </span>
        <ChevronRight size={18} />
      </button>

      <div className="row-between mt-32">
        <div className="section-title profile-section-title">PERSONAL INFORMATION</div>
        {!isEditing && (
          <IconButton label="Edit profile" onClick={() => setIsEditing(true)}>
            <Pencil size={18} />
          </IconButton>
        )}
      </div>

      <div className="stack mt-16">
        <TextField
          label="Full Name"
          value={fullName}
          readOnly={!isEditing}
          autoCapitalize="words"
          icon={<User size={19} />}
          error={errors.fullName}
          onChange={(event) => setFullName(event.target.value)}
        />

        <TextField
          label="ID Number"
          value={idNumber}
          readOnly={!isEditing}
          inputMode="numeric"
          maxLength={13}
          placeholder={isEditing ? '13-digit ID number' : undefined}
          icon={<CreditCard size={19} />}
          error={errors.idNumber}
          onChange={(event) => setIdNumber(event.target.value)}
        />

        <TextField
          label="Contact Number"
          value={contactNumber}
          readOnly={!isEditing}
          type="tel"
          icon={<Phone size={19} />}
          error={errors.contactNumber}
          onChange={(event) => setContactNumber(event.target.value)}
        />

        <SelectField
          label="Location"
          value={selectedLocation ?? ''}
          onChange={setSelectedLocation}
          options={LOCATIONS.map((location) => ({ value: location, label: location }))}
          readOnly={!isEditing}
          error={errors.location}
        />
      </div>

      <div className="section-title profile-section-title mt-32">VEHICLE DETAILS</div>

      <div className="stack mt-16">
        <div className="profile-field-row">
          <TextField
            label="Make"
            value={vehicleMake}
            readOnly={!isEditing}
            error={errors.vehicleMake}
            onChange={(event) => setVehicleMake(event.target.value)}
          />
          <TextField
            label="Model"
            value={vehicleModel}
            readOnly={!isEditing}
            error={errors.vehicleModel}
            onChange={(event) => setVehicleModel(event.target.value)}
          />
        </div>

        <div className="profile-field-row">
          <TextField
            label="Color"
            value={vehicleColor}
            readOnly={!isEditing}
            error={errors.vehicleColor}
            onChange={(event) => setVehicleColor(event.target.value)}
          />
          <TextField
            label="Number Plate"
            value={vehiclePlate}
            readOnly={!isEditing}
            autoCapitalize="characters"
            icon={<Car size={19} />}
            error={errors.vehiclePlate}
            onChange={(event) => setVehiclePlate(event.target.value)}
          />
        </div>
      </div>

      {isEditing && (
        <>
          <Button
            block
            className="profile-save-btn mt-32"
            loading={isSaving}
            onClick={() => void saveProfile()}
          >
            SAVE PROFILE
          </Button>
          <div className="profile-save-note">
            Note: Changing details will require re-verification
          </div>
          <div className="profile-cancel">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          </div>
        </>
      )}

      <div className="section-title profile-section-title profile-section-gap">APP INFO</div>

      <div className="list profile-list">
        <div className="list-item">
          <span className="list-item__icon">
            <RefreshCw size={20} />
          </span>
          <div className="grow">
            <div className="list-item__title">App Version</div>
            <div className="list-item__subtitle">
              Patch level: {patchNumber ?? 'Base version'}
            </div>
            {!ShorebirdService.isAvailable && (
              <div className="profile-shorebird-note">
                {ShorebirdService.unavailabilityReason}
              </div>
            )}
          </div>
          <div className="list-item__trailing">
            {isCheckingForUpdates ? (
              <Spinner size="sm" />
            ) : (
              <Button variant="ghost" size="xs" onClick={() => void checkShorebirdUpdates()}>
                Check for Updates
              </Button>
            )}
          </div>
        </div>

        <div className="list-item">
          <span className="list-item__icon">
            <SunMoon size={20} />
          </span>
          <div className="grow">
            <div className="list-item__title">Theme</div>
            <div className="list-item__subtitle">{themeModeText(themeMode)}</div>
          </div>
          <div className="list-item__trailing">
            <select
              className="profile-theme-select"
              aria-label="Theme"
              value={themeMode}
              onChange={(event) => setThemeMode(event.target.value as ThemeMode)}
            >
              {THEME_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {themeModeText(mode)}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      <div className="section-title profile-section-title mt-24">ACCOUNT</div>

      {signOutError && (
        <StatusMessage
          variant="error"
          title="Could not sign out"
          message={signOutError}
          onDismiss={() => setSignOutError(null)}
        />
      )}

      <button
        type="button"
        className="list-item profile-logout"
        onClick={() => {
          setSignOutError(null);
          void AuthService.signOut().catch((error) => {
            setSignOutError(errorMessage(error));
            // The route will unmount this tab once local state clears; the
            // root toast host survives the redirect.
            UiService.showError(`Could not sign out: ${errorMessage(error)}`);
          });
        }}
      >
        <span className="list-item__icon profile-logout__icon">
          <LogOut size={20} />
        </span>
        <span className="list-item__title profile-logout__title">Logout</span>
      </button>

      {/* Hidden inputs replace image_picker's gallery/camera sources on web. */}
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void onFilePicked(file);
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void onFilePicked(file);
        }}
      />

      {pickerOpen && (
        <Modal onClose={() => setPickerOpen(false)}>
          <div className="list">
            <button
              type="button"
              className="list-item"
              onClick={() => {
                setPickerOpen(false);
                galleryInput.current?.click();
              }}
            >
              <span className="list-item__icon">
                <ImageIcon size={20} />
              </span>
              <span className="list-item__title">Photo Gallery</span>
            </button>
            <button
              type="button"
              className="list-item"
              onClick={() => {
                setPickerOpen(false);
                cameraInput.current?.click();
              }}
            >
              <span className="list-item__icon">
                <Camera size={20} />
              </span>
              <span className="list-item__title">Camera</span>
            </button>
          </div>
        </Modal>
      )}

      {updateDialogOpen && (
        <Modal
          title="Update Available"
          onClose={() => setUpdateDialogOpen(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setUpdateDialogOpen(false)}>
                Later
              </Button>
              <Button
                onClick={() => {
                  setUpdateDialogOpen(false);
                  void downloadShorebirdUpdate();
                }}
              >
                Download
              </Button>
            </>
          }
        >
          <p>A new update is available. Would you like to download it now?</p>
        </Modal>
      )}

    </div>
  );
};
