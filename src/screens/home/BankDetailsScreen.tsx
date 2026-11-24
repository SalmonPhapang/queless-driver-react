import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar } from '../../components/ui/AppBar';
import { Button } from '../../components/ui/Button';
import { SelectField, TextField } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { errorMessage } from '../../lib/errors';
import type { BankDetails, PaystackBank } from '../../services/payoutService';
import { PayoutService } from '../../services/payoutService';
import { UiService } from '../../services/uiService';
import { useAuthStore } from '../../stores/authStore';
import './bank-details.css';

/**
 * Routed replacement for the old bank-details dialog.
 *
 * Account types match the Flutter dialog: Savings / Current / Cheque. An
 * older saved value (e.g. "Business") is kept as an option so nothing is
 * silently lost when the driver opens the form.
 */
const ACCOUNT_TYPES = ['Savings', 'Current', 'Cheque'];

export const BankDetailsScreen = () => {
  const navigate = useNavigate();
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
      navigate('/home/wallet', { replace: true });
    } catch (error) {
      setFormError(`Failed to save: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-frame">
      <div className="screen">
        <AppBar
          title="Bank Account Details"
          back
          onBack={() => navigate('/home/wallet', { replace: true })}
        />
        <div className="screen-body screen-body--pad-lg">
          {loading ? (
            <div className="loading-screen">
              <Spinner />
            </div>
          ) : (
            <div className="bank-details-form stack">
              <p className="text-sm text-muted">Enter your South African bank details for payouts.</p>

              {loadError && (
                <StatusMessage
                  variant="error"
                  title="Could not load bank details"
                  message={loadError}
                  onRetry={() => void load()}
                />
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

              <TextField
                label="Account Number"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value)}
                inputMode="numeric"
              />

              <TextField
                label="Account Holder"
                value={accountHolder}
                onChange={(event) => setAccountHolder(event.target.value)}
                placeholder="Full name as on bank account"
              />

              <TextField
                label="Branch Code"
                value={branchCode}
                readOnly
                wrapClassName="field--readonly"
              />

              <SelectField
                label="Account Type"
                value={accountType}
                onChange={setAccountType}
                options={accountTypeOptions.map((type) => ({ value: type, label: type }))}
              />

              <div className="bank-details-form__actions mt-24">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/home/wallet', { replace: true })}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => void save()} loading={saving}>
                  Save Details
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
