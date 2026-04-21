import { useState, useEffect } from 'react';
import {
  collection, query, where, limit, orderBy,
  onSnapshot, updateDoc, doc, writeBatch, getDocs, Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'appointment' | 'message' | 'system';
  read: boolean;
  createdAt: any;
  isBroadcast?: boolean; // true for admin broadcast notifications
}

const BROADCAST_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function useNotifications(userId: string | undefined | null) {
  const [personalNotifs, setPersonalNotifs] = useState<AppNotification[]>([]);
  const [broadcastNotifs, setBroadcastNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Personal notifications (per-user) ──────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      setPersonalNotifs([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      limit(30)
    );

    let unsub: (() => void) | undefined;

    try {
      unsub = onSnapshot(
        q,
        (snap) => {
          const sorted = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as AppNotification))
            .sort((a, b) => {
              const aMs = a.createdAt?.toMillis?.() ?? 0;
              const bMs = b.createdAt?.toMillis?.() ?? 0;
              return bMs - aMs; // desc
            });
          setPersonalNotifs(sorted);
          setLoading(false);
        },
        (err) => {
          const msg = err?.message ?? '';
          if (!msg.includes('permission') && !msg.includes('PERMISSION_DENIED')) {
            console.warn('Notifications listener error:', msg);
          }
          setPersonalNotifs([]);
          setLoading(false);
        }
      );
    } catch {
      setPersonalNotifs([]);
      setLoading(false);
    }

    return () => { if (unsub) unsub(); };
  }, [userId]);

  // ─── Admin broadcast notifications (global, 24h TTL) ────────────────────────
  // Broadcasts are stored in adminBroadcasts collection and are visible to
  // ALL doctors for 24 hours from when they were sent.
  useEffect(() => {
    if (!userId) {
      setBroadcastNotifs([]);
      return;
    }

    // Only fetch broadcasts sent within the last 24 hours
    const cutoff = Timestamp.fromMillis(Date.now() - BROADCAST_TTL_MS);

    // Query the adminBroadcasts collection for items within the last 24 hours
    const q = query(
      collection(db, 'adminBroadcasts'),
      where('timestamp', '>=', cutoff),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    let unsub: (() => void) | undefined;

    try {
      unsub = onSnapshot(
        q,
        (snap) => {
          const now = Date.now();
          const broadcasts: AppNotification[] = snap.docs
            .map(d => {
              const data = d.data();
              const ts: Timestamp | null = data.timestamp ?? null;
              // Double-check age client-side (in case Firestore timestamp slightly drifts)
              if (ts && (now - ts.toMillis()) > BROADCAST_TTL_MS) return null;
              return {
                id: `broadcast_${d.id}`,
                userId: userId,
                title: data.type === 'broadcast' ? '📢 Admin Broadcast' : `📋 Admin: ${data.senderName || 'Admin'}`,
                message: data.text || '',
                type: 'system' as const,
                read: false, // broadcasts always show as unread (bell count)
                createdAt: ts,
                isBroadcast: true,
              } as AppNotification;
            })
            .filter(Boolean) as AppNotification[];
          setBroadcastNotifs(broadcasts);
        },
        (err) => {
          // Silently fail if not a doctor (patients won't have access)
          if (!err?.message?.includes('permission')) {
            console.warn('Broadcast notifications error:', err?.message);
          }
          setBroadcastNotifs([]);
        }
      );
    } catch {
      setBroadcastNotifs([]);
    }

    return () => { if (unsub) unsub(); };
  }, [userId]);

  // ─── Merge personal + broadcast notifications ──────────────────────────────
  const notifications = [
    ...personalNotifs,
    ...broadcastNotifs,
  ].sort((a, b) => {
    const aMs = a.createdAt?.toMillis?.() ?? 0;
    const bMs = b.createdAt?.toMillis?.() ?? 0;
    return bMs - aMs;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId: string) => {
    // Don't try to update broadcast documents (they have a prefixed id and are read-only for non-admins)
    if (notificationId.startsWith('broadcast_')) return;
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    const unread = personalNotifs.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch {
      // ignore
    }
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}
