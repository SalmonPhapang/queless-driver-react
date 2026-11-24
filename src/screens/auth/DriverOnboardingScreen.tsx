import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera } from 'lucide-react';
import { AppBar } from '../../components/ui/AppBar';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { Switch } from '../../components/ui/Switch';
import { errorMessage } from '../../lib/errors';
import { initialsOf } from '../../lib/format';
import { AuthService } from '../../services/authService';
import { DriverService } from '../../services/driverService';
import { PayoutService, type PaystackBank } from '../../services/payoutService';
import { PushService } from '../../services/pushService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { AppConfig } from '../../config/appConfig';

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
  Record<'fullName' | 'contactNumber' | 'idNumber' | 'vehicleMake' | 'vehicleModel' | 'vehicleColor' | 'vehiclePlate' | 'bank' | 'accountHolder' | 'accountNumber', string>
>;

/** Port of lib/screens/auth/driver_onboarding_screen.dart. */
export const DriverOnboardingScreen = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const fileInput = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleType] = useState('car');
  const [location, setLocation] = useState('Sebokeng');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [addBankDetails, setAddBankDetails] = useState(false);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('Savings');

  useEffect(() => {
    if (!image) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const loadBanks = async () => {
    try {
      setBanks(await PayoutService.getBanks());
    } catch (error) {
      console.debug('Failed to load banks:', error);
    }
  };

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.code === selectedBankCode) ?? null,
    [banks, selectedBankCode],
  );

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

    // The Flutter screen uses the international phone input; entering
    // 0821234567 on the ZA selector becomes +27821234567.
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
      if (image) imageUrl = await DriverService.uploadProfileImage(user.id, image);

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
      navigate('/', { replace: true });
    } catch (error) {
      UiService.showError(`Failed to save profile: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-frame">
      <div className="screen">
        <AppBar title="Complete Your Profile" bordered />
        <div className="screen-body screen-body--pad">
          <div className="stack" style={{ maxWidth: 460, margin: '0 auto' }}>
            <div className="center" style={{ paddingTop: 8 }}>
              <div className="avatar-edit-wrap">
                <button
                  type="button"
                  className="avatar avatar--xl"
                  aria-label="Choose profile photo"
                  onClick={() => fileInput.current?.click()}
                  style={{ border: 0, cursor: 'pointer' }}
                >
                  {imagePreview ? (
                    <img src={imagePreview} alt="Profile preview" />
                  ) : (
                    <span>{initialsOf(fullName)}</span>
                  )}
                </button>
                <span className="avatar-edit">
                  <Camera size={14} />
                </span>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file) setImage(file);
                  event.target.value = '';
                }}
              />
            </div>

            <TextField
              label="Full Name"
              value={fullName}
              error={errors.fullName}
              autoCapitalize="words"
              onChange={(event) => setFullName(event.target.value)}
            />

            <TextField
              label="Contact Number"
              value={contactNumber}
              error={errors.contactNumber}
              type="tel"
              inputMode="tel"
              placeholder="082 123 4567"
              icon={<span style={{ fontSize: 13, fontWeight: 700, paddingRight: 8 }}>+27</span>}
              onChange={(event) => setContactNumber(event.target.value)}
            />

            <TextField
              label="ID Number"
              value={idNumber}
              error={errors.idNumber}
              inputMode="numeric"
              maxLength={13}
              placeholder="13-digit ID number"
              onChange={(event) => setIdNumber(event.target.value.slice(0, 13))}
            />

            <TextField
              label="Vehicle Make (e.g. Toyota)"
              value={vehicleMake}
              error={errors.vehicleMake}
              onChange={(event) => setVehicleMake(event.target.value)}
            />

            <TextField
              label="Vehicle Model (e.g. Corolla)"
              value={vehicleModel}
              error={errors.vehicleModel}
              onChange={(event) => setVehicleModel(event.target.value)}
            />

            <TextField
              label="Vehicle Color"
              value={vehicleColor}
              error={errors.vehicleColor}
              onChange={(event) => setVehicleColor(event.target.value)}
            />

            <TextField
              label="Vehicle Plate Number"
              value={vehiclePlate}
              error={errors.vehiclePlate}
              autoCapitalize="characters"
              onChange={(event) => setVehiclePlate(event.target.value.toUpperCase())}
            />

            <SelectField
              label="Location"
              value={location}
              onChange={setLocation}
              options={LOCATIONS.map((loc) => ({ value: loc, label: loc }))}
            />

            <div className="row-between" style={{ padding: '6px 0' }}>
              <div>
                <div className="label">Add Bank Details Now</div>
                <div className="text-muted text-sm">Required for payouts</div>
              </div>
              <Switch
                checked={addBankDetails}
                label="Add bank details now"
                onChange={(value) => {
                  setAddBankDetails(value);
                  if (value && banks.length === 0) void loadBanks();
                }}
              />
            </div>

            {addBankDetails && (
              <>
                <SelectField
                  label="Select Bank"
                  value={selectedBankCode}
                  error={errors.bank}
                  placeholder={banks.length === 0 ? 'Loading banks…' : 'Select a bank'}
                  onChange={setSelectedBankCode}
                  options={banks.map((bank) => ({ value: bank.code, label: bank.name }))}
                />
                <TextField
                  label="Account Holder Name"
                  value={accountHolder}
                  error={errors.accountHolder}
                  onChange={(event) => setAccountHolder(event.target.value)}
                />
                <TextField
                  label="Account Number"
                  value={accountNumber}
                  error={errors.accountNumber}
                  inputMode="numeric"
                  onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ''))}
                />
                <SelectField
                  label="Account Type"
                  value={accountType}
                  onChange={setAccountType}
                  options={ACCOUNT_TYPES.map((type) => ({ value: type, label: type }))}
                />
              </>
            )}

            <Button
              variant="green"
              block
              loading={loading}
              className="mt-16"
              onClick={() => void save()}
            >
              Complete Onboarding
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
