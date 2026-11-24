import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Bike, ClipboardList, History, UserRound } from 'lucide-react';
import { AppBar } from './ui/AppBar';
import { IconButton } from './ui/IconButton';
import { cn } from '../lib/cn';
import { useAuthStore } from '../stores/authStore';
import { LocationService } from '../services/locationService';
import { NotificationInboxService } from '../services/notificationInboxService';

const TABS = [
  { to: '/home/available', label: 'Available', Icon: ClipboardList },
  { to: '/home/active', label: 'Active', Icon: Bike },
  { to: '/home/history', label: 'History', Icon: History },
  { to: '/home/profile', label: 'Profile', Icon: UserRound },
] as const;

/**
 * Port of lib/screens/home/driver_home_screen.dart.
 *
 * Owns the app bar, the notification badge, the bottom navigation and the
 * tracking lifecycle (start on entry, stop on leave) for the signed-in driver.
 */
export const AppShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [unread, setUnread] = useState(0);

  // The Flutter shell starts/stops tracking with the screen's lifetime and
  // re-syncs whenever the app is resumed.
  useEffect(() => {
    if (!user) {
      LocationService.stopTracking();
      return;
    }
    const sync = () => void LocationService.syncTrackingForDriver({ driverId: user.id });
    sync();
    const onResume = () => {
      if (!document.hidden) sync();
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
      LocationService.stopTracking();
    };
  }, [user]);

  // Badge follows the durable inbox, including while another tab is open.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const count = await NotificationInboxService.fetchUnreadCount();
      if (!cancelled) setUnread(count);
    };
    void refresh();
    const unsubscribe = NotificationInboxService.watchChanges(() => void refresh());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Coming back from the inbox may have marked rows read.
  useEffect(() => {
    void NotificationInboxService.fetchUnreadCount().then(setUnread);
  }, [location.pathname]);

  // Inbox, order details and wallet are pushed *on top* of Flutter's home
  // screen. Keeping this layout mounted preserves tracking and badge updates;
  // only the shell chrome is hidden.
  if (
    location.pathname.startsWith('/home/notifications') ||
    location.pathname.startsWith('/home/orders/') ||
    location.pathname.startsWith('/home/wallet')
  ) {
    return <Outlet />;
  }

  return (
    <div className="app-frame">
      <div className="screen">
        <AppBar
          title="Queless Driver"
          actions={
            <IconButton label="Notifications" badge={unread} onClick={() => navigate('/home/notifications')}>
              <Bell size={21} />
            </IconButton>
          }
        />

        <div className="screen-body">
          <Outlet />
        </div>

        <nav className="bottom-nav" aria-label="Main navigation">
          {TABS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn('bottom-nav__item', isActive && 'bottom-nav__item--active')
              }
            >
              <span className="bottom-nav__icon">
                <Icon size={21} />
              </span>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
