import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleCheck,
  Clock3,
  CodeXml,
  Hash,
  Hourglass,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  UserRound,
} from 'lucide-react';
import { AppBar } from '../../components/ui/AppBar';
import { Button } from '../../components/ui/Button';
import { StatusMessage } from '../../components/ui/StatusMessage';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../lib/errors';
import { formatCurrency } from '../../lib/format';
import type { DeliveryOrder } from '../../models/deliveryOrder';
import type { BankDetails } from '../../services/payoutService';
import { PayoutService } from '../../services/payoutService';
import { OrderService } from '../../services/orderService';
import { useAuthStore } from '../../stores/authStore';
import './wallet.css';

/** Flutter's `SettlementFilter` enum and its exact local-time date ranges. */
const SETTLEMENT_FILTERS = [
  {
    key: 'thisPeriod',
    label: 'This Period',
    range: () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
      };
    },
  },
  {
    key: 'last2Days',
    label: 'Last 2 Days',
    range: () => {
      const now = new Date();
      return {
        from: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
      };
    },
  },
  {
    key: 'lastWeek',
    label: 'Last Week',
    range: () => {
      const now = new Date();
      return {
        from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
      };
    },
  },
  {
    key: 'lastMonth',
    label: 'Last Month',
    range: () => {
      const now = new Date();
      return {
        from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
      };
    },
  },
] as const;

type FilterKey = (typeof SETTLEMENT_FILTERS)[number]['key'];

const BankDetailRow = ({ icon, label, value }: { icon: ReactNode; label: string; value: unknown }) => {
  if (value == null || String(value).length === 0) return null;
  return (
    <div className="summary-row">
      <span className="row" style={{ gap: 10 }}>
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        {label}
      </span>
      <strong className="summary-row__value">{String(value)}</strong>
    </div>
  );
};

/** Port of lib/screens/home/wallet_screen.dart. */
export const WalletScreen = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [settledAmount, setSettledAmount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('thisPeriod');
  const [settledOrderIds, setSettledOrderIds] = useState<Set<string>>(new Set());
  const [recentOrders, setRecentOrders] = useState<DeliveryOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [settlementStatusError, setSettlementStatusError] = useState<string | null>(null);

  const currentFilter = SETTLEMENT_FILTERS.find((filter) => filter.key === activeFilter) ?? SETTLEMENT_FILTERS[0];

  const loadBankDetailsOnly = useCallback(async () => {
    if (!user) return;
    setBankError(null);
    try {
      setBankDetails(await PayoutService.getBankDetails(user.id));
    } catch (error) {
      setBankError(`Failed to load bank details: ${errorMessage(error)}`);
    }
  }, [user]);

  const loadSettlementStatus = useCallback(
    async (from: Date, to: Date) => {
      if (!user || loadingOrders) return;
      setLoadingOrders(true);
      setSettlementStatusError(null);
      try {
        const settled = await PayoutService.getSettledOrderIds(user.id, { from, to });
        const allOrders = await OrderService.fetchMyOrderHistory({ driverId: user.id });
        const completed = allOrders
          .filter((order) => order.status === 'delivered')
          .filter((order) => {
            const updatedAt = order.updatedAt ?? order.createdAt;
            return updatedAt.getTime() >= from.getTime() && updatedAt.getTime() <= to.getTime();
          })
          .slice(0, 10);
        setSettledOrderIds(settled);
        setRecentOrders(completed);
      } catch (error) {
        setSettlementStatusError(`Failed to load settlement status: ${errorMessage(error)}`);
      } finally {
        setLoadingOrders(false);
      }
    },
    [loadingOrders, user],
  );

  const loadSettlementData = useCallback(
    async (filter: FilterKey) => {
      if (!user) return;
      setActiveFilter(filter);
      setLoading(true);
      setSettlementError(null);
      try {
        const { from, to } = SETTLEMENT_FILTERS.find((item) => item.key === filter)!.range();
        const data = await PayoutService.getSettlementData(user.id, { from, to });
        setTotalEarned(data.total_earned ?? 0);
        setSettledAmount(data.settled_amount ?? 0);
        setPendingAmount(data.pending_amount ?? 0);
        setLoading(false);
        // Also load settlement status for completed orders.
        void loadSettlementStatus(from, to);
      } catch (error) {
        setLoading(false);
        setSettlementError(`Failed to load settlement data: ${errorMessage(error)}`);
      }
    },
    [loadSettlementStatus, user],
  );

  useEffect(() => {
    void loadBankDetailsOnly();
    void loadSettlementData('thisPeriod');
    // initState loads bank details immediately and settlement data after the
    // first frame; both are fired once here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadBankDetailsOnly]);

  return (
    <div className="app-frame">
      <div className="screen">
        <AppBar title="Wallet & Settlements" />
        <div className="screen-body">
          <div className="wallet-page">
            <h3 className="section-title text-primary">SELECT TIME PERIOD</h3>
            <div className="wallet-filters hide-scrollbar">
              {SETTLEMENT_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={cn('chip', activeFilter === filter.key && 'chip--active')}
                  onClick={() => void loadSettlementData(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {settlementError && (
              <StatusMessage
                variant="error"
                title="Could not load settlements"
                message={settlementError}
                onRetry={() => void loadSettlementData(activeFilter)}
              />
            )}

            {loading ? (
              <div className="loading-screen">
                <Spinner />
              </div>
            ) : (
              <div className="wallet-hero">
                <div className="wallet-hero__eyebrow">{currentFilter.label.toUpperCase()}</div>
                <div className="wallet-hero__caption">Settlement Summary</div>
                <div className="wallet-hero__amount">{formatCurrency(totalEarned)}</div>
                <div className="wallet-hero__caption">Total earned</div>
                <p className="text-muted text-xs mt-8">
                  Earnings appear when an order is delivered. Payouts run every Tuesday and
                  Thursday; banks can take up to 1 business day to reflect the transfer.
                </p>
                <div className="wallet-hero__divider" />
                <div className="wallet-hero__stats">
                  <div className="wallet-stat">
                    <div className="wallet-stat__amount">{formatCurrency(settledAmount)}</div>
                    <div className="wallet-stat__label">
                      <span className="wallet-stat__dot" style={{ background: 'var(--success)' }} />
                      Settled
                    </div>
                  </div>
                  <div className="wallet-hero__divider wallet-hero__divider--vertical" />
                  <div className="wallet-stat">
                    <div className="wallet-stat__amount">{formatCurrency(pendingAmount)}</div>
                    <div className="wallet-stat__label">
                      <span className="wallet-stat__dot" style={{ background: 'var(--warning)' }} />
                      Pending
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="row-between">
              <h3 className="section-title text-primary">BANK DETAILS</h3>
              <Button
                variant="ghost"
                size="sm"
                icon={
                  bankDetails == null ? <Plus size={18} /> : <Pencil size={18} />
                }
                onClick={() => navigate('/home/wallet/bank-details')}
              >
                {bankDetails == null ? 'Add' : 'Edit'}
              </Button>
            </div>

            {bankError && (
              <StatusMessage
                variant="error"
                title="Could not load bank details"
                message={bankError}
                onRetry={() => void loadBankDetailsOnly()}
              />
            )}

            {bankDetails != null && Object.keys(bankDetails).length > 0 && bankDetails.bank_name != null ? (
              <div className="card card--padded">
                <BankDetailRow icon={<Landmark size={18} />} label="Bank" value={bankDetails.bank_name} />
                <div className="divider" />
                <BankDetailRow icon={<UserRound size={18} />} label="Holder" value={bankDetails.account_holder} />
                <div className="divider" />
                <BankDetailRow icon={<Hash size={18} />} label="Account" value={bankDetails.account_number} />
                <div className="divider" />
                <BankDetailRow icon={<CodeXml size={18} />} label="Code" value={bankDetails.branch_code} />
              </div>
            ) : (
              <div className="card card--padded center" style={{ padding: 24 }}>
                <Landmark size={40} />
                <p className="text-muted mt-8" style={{ fontStyle: 'italic' }}>
                  No bank details configured.
                </p>
                <p className="text-muted text-xs">Add your bank details to receive Tuesday and Thursday payouts.</p>
              </div>
            )}

            <h3 className="section-title text-primary">SETTLEMENT STATUS BY ORDER</h3>
            {settlementStatusError && (
              <StatusMessage
                variant="error"
                title="Could not load order settlements"
                message={settlementStatusError}
                onRetry={() => {
                  const { from, to } = currentFilter.range();
                  void loadSettlementStatus(from, to);
                }}
              />
            )}
            {loadingOrders ? (
              <div className="center" style={{ padding: 20 }}>
                <Spinner />
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="center" style={{ padding: 20 }}>
                <ReceiptText size={40} color="var(--text-faint)" />
                <strong className="mt-12">No completed orders</strong>
                <p className="text-muted text-xs">Orders delivered in this period will appear here</p>
              </div>
            ) : (
              <div className="stack-sm">
                {recentOrders.map((order) => {
                  const isSettled = settledOrderIds.has(order.id);
                  return (
                    <div className="card card--flat" key={order.id}>
                      <span
                        className="wallet-order-icon"
                        style={{
                          background: isSettled ? 'var(--success-soft)' : 'var(--warning-soft)',
                          color: isSettled ? 'var(--success)' : 'var(--warning)',
                        }}
                      >
                        {isSettled ? <CircleCheck size={20} /> : <Clock3 size={20} />}
                      </span>
                      <div className="grow">
                        <div className="info-card__title">#{order.orderNumber ?? order.id.substring(0, 8)}</div>
                        <div className="text-primary text-sm" style={{ fontWeight: 600 }}>
                          {formatCurrency(order.deliveryFee ?? 0)}
                        </div>
                      </div>
                      <span
                        className={cn('badge', isSettled ? 'badge--green' : 'badge--orange')}
                        style={{ gap: 3 }}
                      >
                        {isSettled ? <CircleCheck size={12} /> : <Hourglass size={12} />}
                        {isSettled ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
