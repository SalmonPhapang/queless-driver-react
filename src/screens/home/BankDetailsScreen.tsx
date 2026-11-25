import React, { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { AppBar } from '../../components/AppBar';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { BankDetailsFormSkeleton } from '../../components/Skeleton';
import { StatusMessage } from '../../components/StatusMessage';
import { errorMessage } from '../../lib/errors';
import type { BankDetails, PaystackBank } from '../../services/payoutService';
import { PayoutService } from '../../services/payoutService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

/**
 * Routed replacement for the old bank-details dialog.
 *
 * Account types match the Flutter dialog: Savings / Current / Cheque. An
 * older saved value (e.g. "Business") is kept as an option so nothing is
 * silently lost when the driver opens the form.
 */
const ACCOUNT_TYPES = ['Savings', 'Current', 'Cheque'];

/** Port of lib/screens/home/bank_details_screen.dart. */
export const BankDetailsScreen = () => {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const [banks, setBanks] = useState<PaystackBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [accountType, setAccountType] = useState('Savings');
  const [selectedBank, setSelectedBank] = useState<PaystackBank | undefined>(undefined);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [bankList, details] = await Promise.all([
        PayoutService.getBanks(),
        PayoutService.getBankDetails(user.id),
      ]);
      setBanks(bankList);

      const savedBankName: string | undefined = details?.bank_name;
      const initialSelectedBank = savedBankName
        ? bankList.find((bank) => bank.name === savedBankName) ?? bankList[0]
        : undefined;
      const savedBranchCode = String(details?.branch_code ?? '');

      setAccountHolder(String(details?.account_holder ?? ''));
      setAccountNumber(String(details?.account_number ?? ''));
      setBranchCode(savedBranchCode.length === 0 ? initialSelectedBank?.code ?? '' : savedBranchCode);
      setAccountType(String(details?.account_type ?? 'Savings'));
      setSelectedBank(initialSelectedBank);
    } catch (error) {
      setLoadError(`Failed to load bank details: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const accountTypeOptions =
    accountType.length > 0 && !ACCOUNT_TYPES.includes(accountType)
      ? [...ACCOUNT_TYPES, accountType]
      : ACCOUNT_TYPES;

  const save = async () => {
    if (!user) return;
    if (!selectedBank) {
      setFormError('Please select a bank');
      return;
    }
    if (accountNumber.trim().length === 0) {
      setFormError('Please enter account number');
      return;
    }
    if (accountHolder.trim().length === 0) {
      setFormError('Please enter account holder name');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const details: BankDetails = {
        bank_name: selectedBank.name,
        account_holder: accountHolder.trim(),
        account_number: accountNumber.trim(),
        branch_code: selectedBank.code,
        account_type: accountType,
      };

      await PayoutService.saveBankDetails(user.id, details, { email: user.email, phone: user.phone });
      UiService.showSuccess('Bank details saved.');
      router.replace('/home/wallet');
    } catch (error) {
      setFormError(`Failed to save: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <AppBar
        title="Bank Account Details"
        onBack={() => router.replace('/home/wallet')}
      />
      <View style={styles.body}>
        {loading ? (
          <BankDetailsFormSkeleton />
        ) : (
          <View style={styles.form}>
            <Text style={[typography.bodySmall, styles.intro, { color: colors.textMuted }]}>
              {'Enter your South African bank details for payouts. We pay out every Tuesday and Thursday; your bank may take up to 1 business day to reflect the transfer. Your first payout may take longer while your bank details are verified.'}
            </Text>

            {loadError && (
              <View style={styles.errorBlock}>
                <StatusMessage
                  variant="error"
                  title="Could not load bank details"
                  message={loadError}
                />
                <Button title="Try again" variant="outline" size="sm" onPress={() => void load()} />
              </View>
            )}

            {formError && (
              <StatusMessage
                variant="error"
                title="Could not save bank details"
                message={formError}
                onDismiss={() => setFormError(null)}
              />
            )}

            <SelectField
              label="Bank Name"
              value={selectedBank?.name ?? ''}
              onChange={(value) => {
                const bank = banks.find((option) => option.name === value);
                if (!bank) return;
                setSelectedBank(bank);
                setBranchCode(bank.code);
              }}
              options={banks.map((bank) => ({ value: bank.name, label: bank.name }))}
              placeholder="Select a bank"
            />

            <Input
              label="Account Number"
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="numeric"
            />

            <Input
              label="Account Holder"
              value={accountHolder}
              onChangeText={setAccountHolder}
              placeholder="Full name as on bank account"
            />

            <Input label="Branch Code" value={branchCode} editable={false} />

            <SelectField
              label="Account Type"
              value={accountType}
              onChange={setAccountType}
              options={accountTypeOptions.map((type) => ({ value: type, label: type }))}
            />

            <View style={styles.actions}>
              <Button
                title="Cancel"
                variant="ghost"
                disabled={saving}
                onPress={() => router.replace('/home/wallet')}
              />
              <Button title="Save Details" variant="primary" loading={saving} onPress={() => void save()} />
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: {
    flex: 1,
    padding: 16,
  },
  intro: {
    lineHeight: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: 16,
  },
  errorBlock: {
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
});
