import React, { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AppBar } from '../../components/AppBar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { SettlementRowsSkeleton, WalletSummarySkeleton } from '../../components/Skeleton';
import { StatusMessage } from '../../components/StatusMessage';
import { errorMessage } from '../../lib/errors';
import { formatCurrency } from '../../lib/format';
import type { DeliveryOrder } from '../../models/deliveryOrder';
import type { BankDetails } from '../../services/payoutService';
import { PayoutService } from '../../services/payoutService';
import { OrderService } from '../../services/orderService';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

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

const BankDetailRow = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: unknown;
}) => {
  const { colors } = useTheme();
  if (value == null || String(value).length === 0) return null;
  return (
    <View style={styles.summaryRow}>
      <View style={styles.rowGap}>
        <Text style={{ color: colors.textMuted }}>{icon}</Text>
        <Text style={[typography.bodyMedium, { color: colors.text }]}>{label}</Text>
      </View>
      <Text style={[typography.labelLarge, styles.summaryValue, { color: colors.text }]}>
        {String(value)}
      </Text>
    </View>
  );
};

/** Port of lib/screens/home/wallet_screen.dart. */
export const WalletScreen = () => {
  const { colors } = useTheme();
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

  const currentFilter =
    SETTLEMENT_FILTERS.find((filter) => filter.key === activeFilter) ?? SETTLEMENT_FILTERS[0];

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

  const hasBankDetails =
    bankDetails != null && Object.keys(bankDetails).length > 0 && bankDetails.bank_name != null;

  return (
    <Screen>
      <AppBar title="Wallet & Settlements" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[typography.labelLarge, styles.sectionTitle, { color: colors.primary }]}>
          SELECT TIME PERIOD
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {SETTLEMENT_FILTERS.map((filter) => {
            const active = activeFilter === filter.key;
            return (
              <Button
                key={filter.key}
                title={filter.label}
                variant={active ? 'primary' : 'outline'}
                size="sm"
                onPress={() => void loadSettlementData(filter.key)}
              />
            );
          })}
        </ScrollView>

        {settlementError && (
          <View style={styles.errorBlock}>
            <StatusMessage
              variant="error"
              title="Could not load settlements"
              message={settlementError}
            />
            <Button
              title="Try again"
              variant="outline"
              size="sm"
              onPress={() => void loadSettlementData(activeFilter)}
            />
          </View>
        )}

        {loading ? (
          <WalletSummarySkeleton />
        ) : (
          <Card style={styles.hero}>
            <Text style={[typography.labelSmall, styles.eyebrow, { color: colors.primary }]}>
              {currentFilter.label.toUpperCase()}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>
              Settlement Summary
            </Text>
            <Text style={[typography.display, styles.amount, { color: colors.text }]}>
              {formatCurrency(totalEarned)}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Total earned</Text>
            <Text style={[typography.bodySmall, styles.heroCopy, { color: colors.textMuted }]}>
              {
                'Earnings appear when an order is delivered. Payouts run every Tuesday and Thursday; banks can take up to 1 business day to reflect the transfer.'
              }
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={[typography.titleMedium, styles.statAmount, { color: colors.text }]}>
                  {formatCurrency(settledAmount)}
                </Text>
                <View style={styles.statLabelRow}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Settled</Text>
                </View>
              </View>
              <View style={[styles.dividerVertical, { backgroundColor: colors.divider }]} />
              <View style={styles.stat}>
                <Text style={[typography.titleMedium, styles.statAmount, { color: colors.text }]}>
                  {formatCurrency(pendingAmount)}
                </Text>
                <View style={styles.statLabelRow}>
                  <View style={[styles.dot, { backgroundColor: colors.warning }]} />
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]}>Pending</Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[typography.labelLarge, styles.sectionTitle, { color: colors.primary }]}>
            BANK DETAILS
          </Text>
          <Button
            title={bankDetails == null ? 'Add' : 'Edit'}
            variant="ghost"
            size="sm"
            icon={
              <MaterialCommunityIcons
                name={bankDetails == null ? 'plus' : 'pencil'}
                size={18}
                color={colors.primary}
              />
            }
            onPress={() => router.push('/home/wallet/bank-details')}
          />
        </View>

        {bankError && (
          <View style={styles.errorBlock}>
            <StatusMessage
              variant="error"
              title="Could not load bank details"
              message={bankError}
            />
            <Button
              title="Try again"
              variant="outline"
              size="sm"
              onPress={() => void loadBankDetailsOnly()}
            />
          </View>
        )}

        {hasBankDetails ? (
          <Card style={styles.cardPadded}>
            <BankDetailRow
              icon={<MaterialCommunityIcons name="bank" size={18} color={colors.textMuted} />}
              label="Bank"
              value={bankDetails?.bank_name}
            />
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <BankDetailRow
              icon={<MaterialCommunityIcons name="account-outline" size={18} color={colors.textMuted} />}
              label="Holder"
              value={bankDetails?.account_holder}
            />
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <BankDetailRow
              icon={<MaterialCommunityIcons name="text" size={18} color={colors.textMuted} />}
              label="Account"
              value={bankDetails?.account_number}
            />
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <BankDetailRow
              icon={<MaterialCommunityIcons name="code-tags" size={18} color={colors.textMuted} />}
              label="Code"
              value={bankDetails?.branch_code}
            />
          </Card>
        ) : (
          <Card style={[styles.cardPadded, styles.center]}>
            <MaterialCommunityIcons name="bank" size={40} color={colors.text} />
            <Text style={[typography.bodyMedium, styles.italic, { color: colors.textMuted }]}>
              No bank details configured.
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
              Add your bank details to receive Tuesday and Thursday payouts.
            </Text>
          </Card>
        )}

        <Text style={[typography.labelLarge, styles.sectionTitle, { color: colors.primary }]}>
          SETTLEMENT STATUS BY ORDER
        </Text>
        {settlementStatusError && (
          <View style={styles.errorBlock}>
            <StatusMessage
              variant="error"
              title="Could not load order settlements"
              message={settlementStatusError}
            />
            <Button
              title="Try again"
              variant="outline"
              size="sm"
              onPress={() => {
                const { from, to } = currentFilter.range();
                void loadSettlementStatus(from, to);
              }}
            />
          </View>
        )}
        {loadingOrders ? (
          <SettlementRowsSkeleton />
        ) : recentOrders.length === 0 ? (
          <EmptyState
            title="No completed orders"
            message="Orders delivered in this period will appear here"
            icon={
              <MaterialCommunityIcons
                name="receipt-text-outline"
                size={40}
                color={colors.textMuted}
              />
            }
          />
        ) : (
          <View style={styles.stackSm}>
            {recentOrders.map((order) => {
              const isSettled = settledOrderIds.has(order.id);
              return (
                <Card key={order.id} style={styles.orderRow}>
                  <View
                    style={[
                      styles.orderIcon,
                      {
                        backgroundColor: isSettled ? colors.success : colors.warning,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isSettled ? 'check-circle-outline' : 'clock-outline'}
                      size={20}
                      color={colors.card}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={[typography.titleSmall, { color: colors.text }]}>
                      {`#${order.orderNumber ?? order.id.substring(0, 8)}`}
                    </Text>
                    <Text style={[typography.bodyMedium, styles.orderAmount, { color: colors.text }]}>
                      {formatCurrency(order.deliveryFee ?? 0)}
                    </Text>
                  </View>
                  <View style={styles.badgeWrap}>
                    <MaterialCommunityIcons
                      name={isSettled ? 'check-circle-outline' : 'timer-sand'}
                      size={12}
                      color={isSettled ? colors.success : colors.warning}
                    />
                    <Badge label={isSettled ? 'Paid' : 'Pending'} tone={isSettled ? 'green' : 'orange'} />
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filters: {
    gap: 8,
    paddingRight: 8,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  centerPadded: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  hero: {
    padding: 20,
  },
  eyebrow: {
    fontWeight: '800',
    letterSpacing: 1,
  },
  amount: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
    marginTop: 8,
  },
  heroCopy: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  dividerVertical: {
    width: 1,
    height: 48,
    marginHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statAmount: {
    fontWeight: '700',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardPadded: {
    padding: 20,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  italic: {
    fontStyle: 'italic',
  },
  errorBlock: {
    gap: 8,
  },
  stackSm: {
    gap: 8,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  orderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: {
    flex: 1,
  },
  orderAmount: {
    fontWeight: '600',
    marginTop: 2,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
