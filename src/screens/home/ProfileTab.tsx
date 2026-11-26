import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { ProfileSkeleton } from '../../components/Skeleton';
import { Spinner } from '../../components/Spinner';
import { StatusMessage } from '../../components/StatusMessage';
import { Switch } from '../../components/Switch';
import { UpdateDialog } from '../../components/UpdateDialog';
import { withTimeout } from '../../lib/async';
import { errorMessage } from '../../lib/errors';
import { formatCurrency } from '../../lib/format';
import type { AppVersion } from '../../models/appVersion';
import type { Driver } from '../../models/driver';
import { AuthService } from '../../services/authService';
import { DriverService } from '../../services/driverService';
import { LocationService } from '../../services/locationService';
import { OrderService } from '../../services/orderService';
import { PayoutService } from '../../services/payoutService';
import { UiService } from '../../services/uiService';
import { VersionService } from '../../services/versionService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme, type ThemeMode } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

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

/** Port of lib/screens/home/tabs/profile_tab.dart. */
export const ProfileTab = () => {
  const { colors, mode, setMode } = useTheme();
  const user = useAuthStore((state) => state.user);

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
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [checkingActiveOrders, setCheckingActiveOrders] = useState(false);
  const [statusBlockReason, setStatusBlockReason] = useState<string | null>(null);
  const [updatePrompt, setUpdatePrompt] = useState<{
    version: AppVersion;
    status: 'none' | 'recommended' | 'forced';
  } | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setDriver(null);
      setLoading(false);
      return;
    }

    try {
      const driverProfile = await DriverService.getDriverProfile(user.id);
      if (!alive.current) return;

      setDriver(driverProfile);
      if (driverProfile) {
        setFullName(driverProfile.fullName ?? '');
        setContactNumber(driverProfile.contactNumber ?? '');
        setVehicleMake(driverProfile.vehicleMake ?? '');
        setVehicleModel(driverProfile.vehicleModel ?? '');
        setVehicleColor(driverProfile.vehicleColor ?? '');
        setVehiclePlate(driverProfile.vehiclePlate ?? '');
        setIdNumber(driverProfile.idNumber ?? '');
        setSelectedLocation(driverProfile.location ?? null);

        // An already-online driver is still dispatchable after an app restart.
        // This path never prompts; it only refreshes an existing permission.
        void LocationService.syncDriverPresence({
          driverId: user.id,
          driverStatus: driverProfile.driverStatus ?? '',
        }).catch((error) => {
          console.debug('[profile] Presence sync failed:', error);
        });
      }
    } catch (error) {
      if (!alive.current) return;
      UiService.showError(`Failed to load profile: ${errorMessage(error)}`);
    } finally {
      if (alive.current) setLoading(false);
    }

    // Settlement data is a separate, slower edge call. The profile is already
    // usable at this point, so never keep the whole screen behind it.
    try {
      const settlement = await withTimeout(
        PayoutService.getSettlementData(user.id),
        8_000,
        'Settlement request',
      );
      if (alive.current) setWalletBalance(settlement.total_earned ?? 0);
    } catch (error) {
      console.debug('[profile] Settlement balance unavailable:', error);
    }
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const uploadImage = async (uri: string) => {
    if (!user) return;
    try {
      const imageUrl = await DriverService.uploadProfileImage(user.id, uri);
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

  const pickImage = async (source: 'gallery' | 'camera') => {
    setPickerOpen(false);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      setImagePreview(uri);
      await uploadImage(uri);
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

    if (!name || !phone || !id || !make || !model || !color || !plate || !location) {
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

  const requestStatusChange = async (goOnline: boolean) => {
    if (!user || driver == null || isUpdatingStatus || checkingActiveOrders) return;
    setStatusBlockReason(null);

    // Going offline is only allowed when the driver has no assigned orders
    // still in progress. Check at request time so a stale screen cannot let
    // someone switch off mid-delivery.
    if (!goOnline) {
      setCheckingActiveOrders(true);
      try {
        const activeOrders = await OrderService.fetchMyActiveOrders({ driverId: user.id });
        if (!alive.current) return;
        if (activeOrders.length > 0) {
          const count = activeOrders.length;
          setStatusBlockReason(
            `You have ${count} active ${count === 1 ? 'delivery' : 'deliveries'}. Complete ${count === 1 ? 'it' : 'them'} before going offline.`,
          );
          return;
        }
      } catch (error) {
        if (!alive.current) return;
        UiService.showError(`Could not check active orders: ${errorMessage(error)}`);
        return;
      } finally {
        if (alive.current) setCheckingActiveOrders(false);
      }
    }

    setPendingStatus(goOnline);
  };

  const confirmStatusChange = async () => {
    if (!user || pendingStatus == null) return;
    const nextStatus = pendingStatus;
    setIsUpdatingStatus(true);
    try {
      if (nextStatus) {
        // Publish before the status flip so the first dispatch query already
        // sees a fresh fix, and enable background tracking for app suspension.
        const presence = await LocationService.startOnlinePresence(user.id);
        if (!presence.ok) {
          UiService.showError(
            'Location access is needed to receive nearby delivery offers. Enable it and try again.',
          );
          setPendingStatus(null);
          return;
        }
        if (!presence.backgroundTracking) {
          UiService.showInfo(
            'Your location is shared while the app is open. Allow background location to keep receiving offers when the app is in the background.',
            { duration: 6000 },
          );
        }
      }

      await DriverService.updateOnlineStatus(user.id, nextStatus);
      if (!alive.current) return;
      setDriver((current) =>
        current ? { ...current, driverStatus: nextStatus ? 'online' : 'offline' } : current,
      );
      setPendingStatus(null);
      if (!nextStatus) await LocationService.stopOnlinePresence();
      void loadProfile();
    } catch (error) {
      if (!alive.current) return;
      setPendingStatus(null);
      if (nextStatus) await LocationService.stopOnlinePresence().catch(() => undefined);
      UiService.showError(`Status update failed: ${errorMessage(error)}`);
    } finally {
      if (alive.current) setIsUpdatingStatus(false);
    }
  };

  const checkForUpdates = async () => {
    if (isCheckingForUpdates) return;

    setIsCheckingForUpdates(true);
    try {
      const result = await VersionService.checkForUpdate();
      if (!alive.current) return;

      setPatchNumber(result.version?.buildNumber ?? null);
      if (result.status === 'none') {
        UiService.showInfo('You are up to date!');
      } else if (result.version) {
        setUpdatePrompt({ version: result.version, status: result.status });
      }
    } catch (error) {
      if (!alive.current) return;
      UiService.showError(`Error checking for update: ${errorMessage(error)}`);
    } finally {
      if (alive.current) setIsCheckingForUpdates(false);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  const isOnline = driver?.driverStatus === 'online';
  const isVerified = driver?.isVerified === true;

  return (
    <>
      <Screen scroll contentContainerStyle={styles.content}>
        <View style={styles.hero}>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => setPickerOpen(true)}
          accessibilityLabel="Change profile photo"
        >
          <Avatar
            uri={imagePreview ?? driver?.imageUrl ?? undefined}
            name={driver?.fullName ?? user?.email ?? 'Driver'}
          />
          <View
            style={[
              styles.avatarEdit,
              { backgroundColor: colors.card, borderColor: colors.divider },
            ]}
          >
            <MaterialCommunityIcons name="camera" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>

        <View style={styles.grow}>
          <Text style={[typography.titleLarge, styles.heroName, { color: colors.text }]}>
            {driver?.fullName ?? 'Driver Name'}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textMuted }]}>{user?.email ?? ''}</Text>

          <View style={styles.badges}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: isOnline ? colors.success : colors.error },
                ]}
              />
              <Badge label={isOnline ? 'ONLINE' : 'OFFLINE'} tone={isOnline ? 'green' : 'red'} />
            </View>
            <Badge
              label={isVerified ? 'VERIFIED' : 'UNVERIFIED'}
              tone={isVerified ? 'blue' : 'orange'}
            />
          </View>
        </View>
      </View>

      {driver == null && (
        <View style={styles.statusBlock}>
          <StatusMessage
            variant="warning"
            title="Driver profile unavailable"
            message="We could not load your driver details. You can still review app settings or set the profile up again."
          />
          <Button
            title="Set Up Profile"
            variant="outline"
            size="sm"
            onPress={() => router.replace('/onboarding')}
          />
        </View>
      )}

      <SectionTitle text="DRIVER STATUS" />
      {statusBlockReason && (
        <View style={styles.statusBlock}>
          <StatusMessage
            variant="warning"
            title="Active delivery in progress"
            message={statusBlockReason}
            onDismiss={() => setStatusBlockReason(null)}
          />
        </View>
      )}
      <Card style={styles.availability}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: isOnline ? colors.success : colors.divider },
          ]}
        >
          <MaterialCommunityIcons
            name="flash"
            size={22}
            color={isOnline ? colors.onPrimary : colors.textMuted}
          />
        </View>
        <View style={styles.grow}>
          <Text style={[typography.labelLarge, { color: colors.text }]}>Available for Orders</Text>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {isOnline
              ? 'You are currently visible to customers'
              : 'Turn on to start receiving orders'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={(goOnline) => void requestStatusChange(goOnline)}
          style={styles.statusSwitch}
          disabled={driver == null || isUpdatingStatus || checkingActiveOrders}
        />
      </Card>

      <Card style={styles.earnings} onPress={() => router.push('/home/wallet')}>
        <View style={[styles.iconBubble, { backgroundColor: colors.primaryContainer }]}>
          <MaterialCommunityIcons name="wallet-outline" size={24} color={colors.primary} />
        </View>
        <View style={styles.grow}>
          <Text style={[typography.bodyMedium, { color: colors.text }]}>Total Earnings</Text>
          <Text style={[typography.titleLarge, styles.earningsAmount, { color: colors.text }]}>
            {formatCurrency(walletBalance)}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
      </Card>

      <View style={styles.sectionHeader}>
        <SectionTitle text="PERSONAL INFORMATION" />
        {!isEditing && (
          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            accessibilityLabel="Edit profile"
            style={styles.iconButton}
          >
            <MaterialCommunityIcons name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.stack}>
        <Input
          label="Full Name"
          value={fullName}
          editable={!isEditing}
          autoCapitalize="words"
          error={errors.fullName}
          onChangeText={setFullName}
        />
        <Input
          label="ID Number"
          value={idNumber}
          editable={!isEditing}
          keyboardType="numeric"
          maxLength={13}
          placeholder={isEditing ? '13-digit ID number' : undefined}
          error={errors.idNumber}
          onChangeText={setIdNumber}
        />
        <Input
          label="Contact Number"
          value={contactNumber}
          editable={!isEditing}
          keyboardType="phone-pad"
          error={errors.contactNumber}
          onChangeText={setContactNumber}
        />
        <SelectField
          label="Location"
          value={selectedLocation ?? ''}
          onChange={setSelectedLocation}
          options={LOCATIONS.map((location) => ({ value: location, label: location }))}
          error={errors.location}
          disabled={!isEditing}
        />
      </View>

      <SectionTitle text="VEHICLE DETAILS" />
      <View style={styles.stack}>
        <View style={styles.fieldRow}>
          <View style={styles.fieldCell}>
            <Input
              label="Make"
              value={vehicleMake}
              editable={!isEditing}
              error={errors.vehicleMake}
              onChangeText={setVehicleMake}
            />
          </View>
          <View style={styles.fieldCell}>
            <Input
              label="Model"
              value={vehicleModel}
              editable={!isEditing}
              error={errors.vehicleModel}
              onChangeText={setVehicleModel}
            />
          </View>
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldCell}>
            <Input
              label="Color"
              value={vehicleColor}
              editable={!isEditing}
              error={errors.vehicleColor}
              onChangeText={setVehicleColor}
            />
          </View>
          <View style={styles.fieldCell}>
            <Input
              label="Number Plate"
              value={vehiclePlate}
              editable={!isEditing}
              autoCapitalize="characters"
              error={errors.vehiclePlate}
              onChangeText={setVehiclePlate}
            />
          </View>
        </View>
      </View>

      {isEditing && (
        <View style={styles.saveBlock}>
          <Button title="SAVE PROFILE" block loading={isSaving} onPress={() => void saveProfile()} />
          <Text style={[typography.caption, styles.saveNote, { color: colors.textMuted }]}>
            Note: Changing details will require re-verification
          </Text>
          <Button title="Cancel" variant="ghost" onPress={() => setIsEditing(false)} />
        </View>
      )}

      <SectionTitle text="APP INFO" style={styles.appInfoTitle} />
      <View style={styles.stack}>
        <Card style={styles.listRow}>
          <View style={[styles.listIcon, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
          </View>
          <View style={styles.grow}>
            <Text style={[typography.labelLarge, { color: colors.text }]}>App Version</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {`Patch level: ${patchNumber ?? 'Base version'}`}
            </Text>
          </View>
          <View style={styles.trailing}>
            {isCheckingForUpdates ? (
              <Spinner />
            ) : (
              <Button
                title="Check for Updates"
                variant="ghost"
                size="sm"
                onPress={() => void checkForUpdates()}
              />
            )}
          </View>
        </Card>

        <TouchableOpacity
          style={[styles.listRow, styles.listRowPressable, { backgroundColor: colors.card }]}
          onPress={() => setThemePickerOpen(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.listIcon, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name="theme-light-dark" size={20} color={colors.primary} />
          </View>
          <View style={styles.grow}>
            <Text style={[typography.labelLarge, { color: colors.text }]}>Theme</Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {themeModeText(mode)}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <SectionTitle text="ACCOUNT" style={styles.accountTitle} />

      {signOutError && (
        <StatusMessage
          variant="error"
          title="Could not sign out"
          message={signOutError}
          onDismiss={() => setSignOutError(null)}
        />
      )}

      <TouchableOpacity
        style={[styles.listRow, styles.logoutRow, { backgroundColor: colors.card }]}
        onPress={() => {
          setSignOutError(null);
          void AuthService.signOut().catch((error) => {
            setSignOutError(errorMessage(error));
            // The route will unmount this tab once local state clears; the
            // root toast host survives the redirect.
            UiService.showError(`Could not sign out: ${errorMessage(error)}`);
          });
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.listIcon, { backgroundColor: colors.error }]}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.onError} />
        </View>
        <Text style={[typography.labelLarge, styles.logoutTitle, { color: colors.text }]}>
          Logout
        </Text>
      </TouchableOpacity>

      {/* Photo source picker replaces image_picker's gallery/camera sources on web. */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => void pickImage('gallery')}
              activeOpacity={0.7}
            >
              <View style={[styles.listIcon, { backgroundColor: colors.primaryContainer }]}>
                <MaterialCommunityIcons name="image" size={20} color={colors.primary} />
              </View>
              <Text style={[typography.labelLarge, { color: colors.text }]}>Photo Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalRow}
              onPress={() => void pickImage('camera')}
              activeOpacity={0.7}
            >
              <View style={[styles.listIcon, { backgroundColor: colors.primaryContainer }]}>
                <MaterialCommunityIcons name="camera" size={20} color={colors.primary} />
              </View>
              <Text style={[typography.labelLarge, { color: colors.text }]}>Camera</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={themePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setThemePickerOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.divider }]}>
            <Text style={[typography.titleMedium, styles.modalTitle, { color: colors.text }]}>
              Theme
            </Text>
            {THEME_MODES.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.modalRow}
                onPress={() => {
                  setMode(option);
                  setThemePickerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.listIcon, { backgroundColor: colors.primaryContainer }]}>
                  <MaterialCommunityIcons
                    name={option === 'light' ? 'white-balance-sunny' : option === 'dark' ? 'weather-night' : 'theme-light-dark'}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={[typography.labelLarge, styles.grow, { color: colors.text }]}>
                  {themeModeText(option)}
                </Text>
                {mode === option && (
                  <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
      </Screen>

      <ConfirmationDialog
        visible={pendingStatus !== null}
        icon={
          pendingStatus === true ? (
            <MaterialCommunityIcons name="flash" size={28} color={colors.onPrimary} />
          ) : (
            <MaterialCommunityIcons name="flash-off" size={28} color={colors.onPrimary} />
          )
        }
        title={pendingStatus === true ? 'Go online?' : 'Go offline?'}
        message={
          pendingStatus === true
            ? isVerified
              ? "Your live location will be shared while you're online so nearby orders can reach you. Keep background location enabled; force-closing the app may pause offers."
              : "You'll appear online, but accepting orders stays locked until your profile is verified."
            : "You'll stop receiving new delivery offers and location sharing until you switch back online."
        }
        confirmLabel={pendingStatus === true ? 'GO ONLINE' : 'GO OFFLINE'}
        tone={pendingStatus === true ? 'success' : 'warning'}
        loading={isUpdatingStatus}
        onConfirm={() => void confirmStatusChange()}
        onCancel={() => setPendingStatus(null)}
      />

      {updatePrompt && (
        <UpdateDialog
          version={updatePrompt.version}
          status={updatePrompt.status}
          onClose={() => setUpdatePrompt(null)}
        />
      )}
    </>
  );
};

const SectionTitle = ({
  text,
  style,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
}) => {
  const { colors } = useTheme();
  return (
    <Text style={[typography.labelLarge, styles.sectionTitle, style, { color: colors.textMuted }]}>
      {text}
    </Text>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  statusBlock: {
    gap: 8,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarButton: {
    position: 'relative',
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  heroName: {
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  appInfoTitle: {
    marginTop: 16,
  },
  accountTitle: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  availability: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  statusSwitch: {
    flexShrink: 0,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    padding: 6,
  },
  earnings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  earningsAmount: {
    fontWeight: '800',
    marginTop: 4,
  },
  stack: {
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldCell: {
    flex: 1,
  },
  saveBlock: {
    gap: 12,
  },
  saveNote: {
    textAlign: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  listRowPressable: {
    borderRadius: 12,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: {
    maxWidth: 150,
  },
  logoutRow: {
    borderRadius: 12,
  },
  logoutTitle: {
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
  },
  modalTitle: {
    padding: 12,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
  },
});
