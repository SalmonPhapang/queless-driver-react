import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Bike,
  CheckCheck,
  CircleCheck,
  Hash,
  ReceiptText,
  Truck,
  XCircle,
} from 'lucide-react';
import { AppBar } from '../../components/ui/AppBar';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../lib/cn';
import type { UserNotification } from '../../models/userNotification';
import { UserNotificationModel } from '../../models/userNotification';
import { NotificationInboxService } from '../../services/notificationInboxService';

const iconFor = (type: string) => {
  switch (type) {
    case 'order_assigned':
      return Truck;
    case 'order_cancelled':
    case 'order_rejected':
      return XCircle;
    case 'order_ready_for_pickup':
      return ReceiptText;
    case 'order_delivered':
      return CircleCheck;
    case 'new_order':
      return Bike;
    default:
      return Bell;
  }
};

const colourFor = (type: string): string => {
  switch (type) {
    case 'order_assigned':
      return '#0f766e';
    case 'order_cancelled':
    case 'order_rejected':
      return '#ef4444';
    case 'order_ready_for_pickup':
      return '#b45309';
    case 'order_delivered':
      return '#15803d';
    default:
      return 'var(--primary)';
  }
};

/** Flutter's inline `_timeLabel` (d/m/yyyy for anything older than a week). */
const timeLabel = (createdAt: Date): string => {
  const seconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${createdAt.getDate()}/${createdAt.getMonth() + 1}/${createdAt.getFullYear()}`;
};

/** Port of lib/screens/notifications/notification_inbox_screen.dart. */
export const NotificationInboxScreen = () => {
  const navigate = useNavigate();
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
    navigate(`/home/orders/${notification.orderId}`, { state: { fromNotification: true } });
  };

  const markAllRead = async () => {
    await NotificationInboxService.markAllRead();
    void refresh(false);
  };

  const hasUnread = notifications.some((row) => !row.isRead);

  return (
    <div className="app-frame">
      <div className="screen">
        <AppBar
          title="Notifications"
          back
          actions={
            hasUnread ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => void markAllRead()}
                disabled={refreshing}
              >
                <CheckCheck size={18} />
                Mark all read
              </button>
            ) : undefined
          }
        />

        <div className="screen-body">
          {loading ? (
            <div className="loading-screen">
              <Spinner />
            </div>
          ) : notifications.length === 0 ? (
            <div className="empty">
              <div className="empty__icon">
                <Bell size={64} strokeWidth={1.5} />
              </div>
              <div className="empty__title">No notifications yet</div>
              <p className="empty__text">
                New order assignments and updates will appear here.
              </p>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {notifications.map((notification) => {
                const Icon = iconFor(notification.type);
                const colour = colourFor(notification.type);
                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={cn(
                      'notification-item',
                      notification.isRead && 'notification-item--read',
                    )}
                    onClick={() => void open(notification)}
                  >
                    <span className="notification-item__icon-wrap">
                      <span
                        className="notification-item__icon"
                        style={{ background: `color-mix(in srgb, ${colour} 12%, transparent)`, color: colour }}
                      >
                        <Icon size={20} />
                      </span>
                      {!notification.isRead && <span className="notification-item__dot" />}
                    </span>

                    <span className="grow">
                      <span className="row-between" style={{ alignItems: 'flex-start' }}>
                        <span className="notification-item__title grow">{notification.title}</span>
                        <span className="notification-item__time">{timeLabel(notification.createdAt)}</span>
                      </span>
                      <span className="notification-item__body" style={{ display: 'block' }}>
                        {notification.body}
                      </span>
                      {notification.orderNumber && (
                        <span className="notification-item__order">
                          <Hash size={13} />
                          Order #{notification.orderNumber}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
