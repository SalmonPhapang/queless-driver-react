import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AppBar } from '../../components/AppBar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { NotificationsSkeleton } from '../../components/Skeleton';
import type { UserNotification } from '../../models/userNotification';
import { UserNotificationModel } from '../../models/userNotification';
import { NotificationInboxService } from '../../services/notificationInboxService';
import { useTheme } from '../../theme/ThemeContext';
import { typography } from '../../theme/typography';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const iconFor = (type: string): IconName => {
  switch (type) {
    case 'order_assigned':
      return 'truck-outline';
    case 'order_cancelled':
    case 'order_rejected':
      return 'close-circle-outline';
    case 'order_ready_for_pickup':
      return 'receipt-text-outline';
    case 'order_delivered':
      return 'check-circle-outline';
    case 'new_order':
      return 'bike';
    default:
      return 'bell-outline';
  }
};

/** Flutter's inline `_timeLabel` (d/m/yyyy for anything older than a week). */
const timeLabel = (createdAt: string | Date): string => {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

/** Port of lib/screens/notifications/notification_inbox_screen.dart. */
export const NotificationInboxScreen = () => {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const refresh = useCallback(async (initial: boolean) => {
    if (initial) setLoading(true);
    else {
      refreshingRef.current = true;
      setRefreshing(true);
    }
    const rows = await NotificationInboxService.fetchNotifications(200);
    setNotifications(rows);
    setLoading(false);
    refreshingRef.current = false;
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh(true);
    const unsubscribe = NotificationInboxService.watchChanges(() => {
      // Flutter ignores realtime events while a manual refresh is in flight.
      if (refreshingRef.current) return;
      void refresh(false);
    });
    return unsubscribe;
  }, [refresh]);

  const open = async (notification: UserNotification) => {
    if (!notification.isRead) await NotificationInboxService.markRead(notification.id);

    if (!UserNotificationModel.isOrderRelated(notification) || !notification.orderId) return;
    // Flutter passes the freshly fetched order into details with its default
    // `isVerified: true`; the route fetch below does the equivalent without
    // letting a pending profile row disable the accept button.
    router.push(`/home/orders/${notification.orderId}?fromNotification=true`);
  };

  const markAllRead = async () => {
    await NotificationInboxService.markAllRead();
    void refresh(false);
  };

  const hasUnread = notifications.some((row) => !row.isRead);

  const colourFor = (type: string): string => {
    switch (type) {
      case 'order_assigned':
        return colors.info;
      case 'order_cancelled':
      case 'order_rejected':
        return colors.error;
      case 'order_ready_for_pickup':
        return colors.warning;
      case 'order_delivered':
        return colors.success;
      default:
        return colors.primary;
    }
  };

  return (
    <Screen>
      <AppBar
        title="Notifications"
        onBack={() => router.back()}
        right={
          hasUnread ? (
            <Button
              title="Mark all read"
              variant="ghost"
              size="sm"
              icon={<MaterialCommunityIcons name="check-all" size={18} color={colors.primary} />}
              disabled={refreshing}
              onPress={() => void markAllRead()}
            />
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <NotificationsSkeleton />
        ) : notifications.length === 0 ? (
          <EmptyState
            title="No notifications yet"
            message="New order assignments and updates will appear here."
            icon={<MaterialCommunityIcons name="bell-outline" size={64} color={colors.textMuted} />}
          />
        ) : (
          <View style={styles.list}>
            {notifications.map((notification) => {
              const colour = colourFor(notification.type);
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.item,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.divider,
                      opacity: notification.isRead ? 0.72 : 1,
                    },
                  ]}
                  onPress={() => void open(notification)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconWrap}>
                    <View style={[styles.icon, { backgroundColor: colors.divider }]}>
                      <MaterialCommunityIcons
                        name={iconFor(notification.type)}
                        size={20}
                        color={colour}
                      />
                    </View>
                    {!notification.isRead && (
                      <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                    )}
                  </View>

                  <View style={styles.grow}>
                    <View style={styles.itemHeader}>
                      <Text style={[typography.labelLarge, styles.title, { color: colors.text }]}>
                        {notification.title}
                      </Text>
                      <Text style={[typography.caption, styles.time, { color: colors.textMuted }]}>
                        {timeLabel(notification.createdAt)}
                      </Text>
                    </View>
                    <Text style={[typography.bodySmall, styles.body, { color: colors.textMuted }]}>
                      {notification.body}
                    </Text>
                    {notification.orderNumber && (
                      <View style={styles.orderRow}>
                        <MaterialCommunityIcons name="pound" size={13} color={colors.textMuted} />
                        <Text style={[typography.caption, { color: colors.textMuted }]}>
                          {`Order #${notification.orderNumber}`}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
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
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  list: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    position: 'relative',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  grow: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontWeight: '700',
  },
  time: {
    flexShrink: 0,
  },
  body: {
    marginTop: 4,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
});
