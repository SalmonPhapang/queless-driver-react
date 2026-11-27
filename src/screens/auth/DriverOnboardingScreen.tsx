import { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppBar } from '../../components/AppBar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Switch } from '../../components/Switch';
import { AppConfig } from '../../config/appConfig';
import { errorMessage } from '../../lib/errors';
import { initialsOf } from '../../lib/format';
import type { PaystackBank } from '../../services/payoutService';
import { PayoutService } from '../../services/payoutService';
import { AuthService } from '../../services/authService';
import { DriverService } from '../../services/driverService';
import { PushService } from '../../services/pushService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

const LOCATIONS = ['Sebokeng', 'Evaton', 'Orange Farm', 'Vanderbijlpark', 'Vereeniging'];
const ACCOUNT_TYPES = ['Savings', 'Current', 'Business'];

/** `InternationalPhoneNumberInput` with a ZA initial value normalises to +27. */
const normalisePhone = (value: string): string => {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (compact.startsWith('+')) return `+${compact.slice(1).replace(/\D/g, '')}`;
  const digits = compact.replace(/\D/g, '');
  if (digits.startsWith('27')) return `+${digits}`;
  return `+27${digits.replace(/^0+/, '')}`;
};

type Errors = Partial<
  Record<
    | 'fullName'
    | 'contactNumber'
    | 'idNumber'
    | 'vehicleMake'
    | 'vehicleModel'
    | 'vehicleColor'
    | 'vehiclePlate'
    | 'bank'
    | 'accountHolder'
    | 'accountNumber',
    string
  >
>;

/** Port of lib/screens/auth/driver_onboarding_screen.dart. */
export const DriverOnboardingScreen = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);

  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType] = useState('car');
  const [location, setLocation] = useState('Sebokeng');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [addBankDetails, setAddBankDetails] = useState(false);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [bankLoadError, setBankLoadError] = useState<string | null>(null);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('Savings');

  const loadBanks = async () => {
    try {
      setBanks(await PayoutService.getBanks());
      setBankLoadError(null);
      setErrors((prev) => ({ ...prev, bank: undefined }));
    } catch (error) {
      console.debug('Failed to load banks:', error);
      setBanks([]);
      const message = `Could not load banks: ${errorMessage(error)}`;
      setBankLoadError(message);
      setErrors((prev) => ({ ...prev, bank: message }));
    }
  };

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.code === selectedBankCode) ?? null,
    [banks, selectedBankCode],
  );

  const pickImage = async (source: 'camera' | 'library') => {
    setPickerOpen(false);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
      if (!result.canceled && result.assets[0]?.uri) setImageUri(result.assets[0].uri);
    } catch (error) {
      console.debug('Could not pick profile photo:', error);
    }
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!fullName.trim()) next.fullName = 'Please enter your full name';
    const phoneDigits = contactNumber.replace(/\D/g, '');
    if (!phoneDigits) next.contactNumber = 'Please enter your contact number';
    if (!idNumber) next.idNumber = 'Please enter your ID number';
    else if (idNumber.length !== 13) next.idNumber = 'ID number must be exactly 13 digits';
    else if (!/^\d+$/.test(idNumber)) next.idNumber = 'ID number must contain only digits';
    if (!vehicleMake.trim()) next.vehicleMake = 'Please enter vehicle make';
    if (!vehicleModel.trim()) next.vehicleModel = 'Please enter vehicle model';
    if (!vehicleColor.trim()) next.vehicleColor = 'Please enter vehicle color';
    if (!vehiclePlate.trim()) next.vehiclePlate = 'Please enter plate number';
    if (addBankDetails) {
      if (!selectedBankCode) next.bank = 'Please select a bank';
      if (!accountHolder.trim()) next.accountHolder = 'Please enter account holder name';
      if (!accountNumber.trim()) next.accountNumber = 'Please enter account number';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!user) return;
    if (!validate()) return;

    // Flutter's international phone input turns 0821234567 into +27821234567.
    const normalisedPhone = normalisePhone(contactNumber);

    // Flutter's extra safety check runs after FormState.validate()/save().
    if (
      !fullName ||
      !idNumber ||
      !vehicleMake ||
      !vehicleModel ||
      !vehicleColor ||
      !vehiclePlate ||
      !normalisedPhone
    ) {
      UiService.showError('Please fill in all required fields before submitting');
      return;
    }

    setLoading(true);
    try {
      let imageUrl: string | undefined;
      if (imageUri) imageUrl = await DriverService.uploadProfileImage(user.id, imageUri);

      await DriverService.saveProfile({
        id: user.id,
        fullName: fullName.trim(),
        vehicleMake: vehicleMake.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        vehiclePlate: vehiclePlate.trim(),
        vehicleType,
        imageUrl,
        contactNumber: normalisedPhone,
        idNumber,
        location,
      });

      if (addBankDetails && selectedBank) {
        await PayoutService.saveBankDetails(
          user.id,
          {
            bank_name: selectedBank.name,
            account_holder: accountHolder,
            account_number: accountNumber,
            branch_code: selectedBank.code,
            account_type: accountType,
          },
          { email: user.email, phone: normalisedPhone },
        );
      }

      if (AppConfig.featureFirebase) await PushService.registerDriver(user.id);
      await AuthService.refreshUser();
      // RootGate re-evaluates the whole gate once the profile exists.
      router.replace('/');
    } catch (error) {
      UiService.showError(`Failed to save profile: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll={false} padded={false}>
      <AppBar title="Complete Your Profile" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.avatarBlock}>
            <View>
              <Pressable
                accessibilityLabel="Choose profile photo"
                onPress={() => setPickerOpen(true)}
                style={[styles.avatar, { borderColor: colors.divider, backgroundColor: colors.surface }]}
              >
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={[typography.headlineLarge, { color: colors.text }]}>
                    {initialsOf(fullName)}
                  </Text>
                )}
              </Pressable>
              <View
                style={[
                  styles.cameraBadge,
                  { backgroundColor: colors.accent, borderColor: colors.cardBackground },
                ]}
              >
                <MaterialCommunityIcons name="camera" size={14} color={colors.onPrimary} />
              </View>
            </View>
          </View>

          <Input
            compact
            label="Full Name"
            value={fullName}
            error={errors.fullName}
            autoCapitalize="words"
            onChangeText={setFullName}
          />

          <Input
            compact
            prefix="+27"
            label="Contact Number"
            value={contactNumber}
            error={errors.contactNumber}
            keyboardType="phone-pad"
            placeholder="82 123 4567"
            onChangeText={setContactNumber}
          />

          <Input
            compact
            label="ID Number"
            value={idNumber}
            error={errors.idNumber}
            keyboardType="numeric"
            maxLength={13}
            placeholder="13-digit ID number"
            onChangeText={(value) => setIdNumber(value.slice(0, 13))}
          />

          <Input
            compact
            label="Vehicle Make (e.g. Toyota)"
            value={vehicleMake}
            error={errors.vehicleMake}
            onChangeText={setVehicleMake}
          />

          <Input
            compact
            label="Vehicle Model (e.g. Corolla)"
            value={vehicleModel}
            error={errors.vehicleModel}
            onChangeText={setVehicleModel}
          />

          <Input
            compact
            label="Vehicle Color"
            value={vehicleColor}
            error={errors.vehicleColor}
            onChangeText={setVehicleColor}
          />

          <Input
            compact
            label="Vehicle Plate Number"
            value={vehiclePlate}
            error={errors.vehiclePlate}
            autoCapitalize="characters"
            onChangeText={(value) => setVehiclePlate(value.toUpperCase())}
          />

          <SelectField
            compact
            label="Location"
            value={location}
            onChange={setLocation}
            options={LOCATIONS.map((loc) => ({ value: loc, label: loc }))}
          />

          <View style={styles.bankToggle}>
            <View style={styles.grow}>
              <Text style={[typography.labelLarge, { color: colors.text }]}>
                Add Bank Details Now
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                Required for payouts
              </Text>
            </View>
            <Switch
              value={addBankDetails}
              onValueChange={(value) => {
                setAddBankDetails(value);
                if (value && banks.length === 0) void loadBanks();
              }}
            />
          </View>

          {addBankDetails && (
            <>
              <SelectField
                compact
                label="Select Bank"
                value={selectedBankCode}
                error={bankLoadError ?? errors.bank}
                placeholder={
                  banks.length === 0 && !bankLoadError ? 'Loading banks…' : 'Select a bank'
                }
                onChange={setSelectedBankCode}
                options={banks.map((bank) => ({ value: bank.code, label: bank.name }))}
              />
              {bankLoadError ? (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Retry banks"
                  onPress={() => void loadBanks()}
                />
              ) : null}
              <Input
                compact
                label="Account Holder Name"
                value={accountHolder}
                error={errors.accountHolder}
                onChangeText={setAccountHolder}
              />
              <Input
                compact
                label="Account Number"
                value={accountNumber}
                error={errors.accountNumber}
                keyboardType="numeric"
                onChangeText={(value) => setAccountNumber(value.replace(/\D/g, ''))}
              />
              <SelectField
                compact
                label="Account Type"
                value={accountType}
                onChange={setAccountType}
                options={ACCOUNT_TYPES.map((type) => ({ value: type, label: type }))}
              />
            </>
          )}

          <Button
            title="Complete Onboarding"
            variant="green"
            block
            loading={loading}
            onPress={() => void save()}
          />
        </View>
      </ScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
            <Text style={[typography.titleLarge, styles.sheetTitle, { color: colors.text }]}>
              Choose profile photo
            </Text>
            <Button title="Take Photo" variant="ghost" block onPress={() => void pickImage('camera')} />
            <Button
              title="Choose from Library"
              variant="ghost"
              block
              onPress={() => void pickImage('library')}
            />
            <Button
              title="Cancel"
              variant="outline"
              block
              onPress={() => setPickerOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { padding: 16, flexGrow: 1 },
  form: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 10 },
  avatarBlock: { alignItems: 'center', paddingTop: 0, paddingBottom: 2 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  grow: { flex: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { width: '100%', maxWidth: 360, borderRadius: 16, padding: 20, gap: 10 },
  sheetTitle: { marginBottom: 6 },
});
