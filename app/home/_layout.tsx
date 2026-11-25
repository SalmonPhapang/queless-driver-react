import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RequireAuth } from '../../src/components/RequireAuth';
import { NotificationInboxService } from '../../src/services/notificationInboxService';
import { useTheme } from '../../src/theme/ThemeContext';

function DriverTabs() {
  const { colors } = useTheme();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const count = await NotificationInboxService.fetchUnreadCount();
      if (active) setUnread(count);
    };
    void refresh();
    const unsubscribe = NotificationInboxService.watchChanges(() => void refresh());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.headerBackground,
          borderTopColor: colors.divider,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="available"
        options={{
          title: 'Available',
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="active"
        options={{
          title: 'Active',
          tabBarIcon: ({ color, size }) => <Ionicons name="navigate-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{ href: null, title: 'Wallet' }}
      />
      <Tabs.Screen
        name="wallet/bank-details"
        options={{ href: null, title: 'Bank details' }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          href: null,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color as string} />,
        }}
      />
      <Tabs.Screen
        name="orders/[orderId]"
        options={{ href: null, title: 'Order details' }}
      />
    </Tabs>
  );
}

export default function HomeLayout() {
  return (
    <RequireAuth>
      <DriverTabs />
    </RequireAuth>
  );
}
