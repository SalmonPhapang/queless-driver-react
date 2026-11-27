// Port of lib/services/notification_inbox_service.dart.
//
// Reads/writes the durable `notifications` table for the signed-in driver. The
// `orders-status` edge function inserts rows whenever it sends a push, so the
// inbox shows everything the driver missed while offline.

import { SupabaseConfig } from '../config/supabaseClient';
import { UserNotification, UserNotificationModel } from '../models/userNotification';

const currentUserId = (): string | null => SupabaseConfig.currentUserId;

export const NotificationInboxService = {
  /**
   * Subscribes to the driver's notification rows (insert, update, delete).
   * Requires `notifications` in the `supabase_realtime` publication; if it is
   * not, this simply never fires and the UI falls back to pull-to-refresh.
   * RLS is enforced on the subscription.
   */
  watchChanges(onChange: () => void): () => void {
    const uid = currentUserId();
    if (!uid) return () => undefined;

    const channel = SupabaseConfig.client
      .channel(`driver-notification-inbox-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${uid}`,
        },
        () => onChange(),
      )
      .subscribe();

    return () => {
      void SupabaseConfig.client.removeChannel(channel);
    };
  },

  async fetchNotifications(limit = 100): Promise<UserNotification[]> {
    const uid = currentUserId();
    if (!uid) return [];

    try {
      const { data, error } = await SupabaseConfig.client
        .from('notifications')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (Array.isArray(data) ? data : []).map((row) =>
        UserNotificationModel.fromJson(row as Record<string, unknown>),
      );
    } catch (error) {
      console.debug('Driver inbox: error fetching notifications:', error);
      return [];
    }
  },

  /** Count unread rows for the badge. Returns 0 on error / not-signed-in. */
  async fetchUnreadCount(): Promise<number> {
    const uid = currentUserId();
    if (!uid) return 0;

    try {
      const { data, error } = await SupabaseConfig.client
        .from('notifications')
        .select('id')
        .eq('user_id', uid)
        .eq('is_read', false)
        .limit(200);
      if (error) throw error;
      return Array.isArray(data) ? data.length : 0;
    } catch (error) {
      console.debug('Driver inbox: error counting unread:', error);
      return 0;
    }
  },

  async markRead(id: string): Promise<void> {
    const uid = currentUserId();
    if (!uid) return;
    try {
      const { error } = await SupabaseConfig.client
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', uid);
      if (error) throw error;
    } catch (error) {
      console.debug(`Driver inbox: markRead failed id=${id}:`, error);
    }
  },

  /** Close out the dispatch-offer rows once the driver has claimed the order. */
  async markOrderOffersRead(orderId: string): Promise<void> {
    const uid = currentUserId();
    if (!uid) return;
    try {
      const { error } = await SupabaseConfig.client
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('user_id', uid)
        .eq('order_id', orderId)
        .eq('type', 'dispatch_offer')
        .eq('is_read', false);
      if (error) throw error;
    } catch (error) {
      console.debug(`Driver inbox: markOrderOffersRead failed order=${orderId}:`, error);
    }
  },

  async markAllRead(): Promise<void> {
    const uid = currentUserId();
    if (!uid) return;
    try {
      const { error } = await SupabaseConfig.client
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('user_id', uid)
        .eq('is_read', false);
      if (error) throw error;
    } catch (error) {
      console.debug('Driver inbox: markAllRead failed:', error);
    }
  },
};
