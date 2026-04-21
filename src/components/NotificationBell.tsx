import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Calendar, MessageSquare, Settings2, X } from 'lucide-react';
import { useNotifications, AppNotification } from '../hooks/useNotifications';
import { format } from 'date-fns';

interface NotificationBellProps {
  userId: string | undefined | null;
  /** Visual theme: 'light' (patient/doctor) or 'dark' (admin) */
  theme?: 'light' | 'dark';
}

function getTypeIcon(type: AppNotification['type']) {
  switch (type) {
    case 'appointment': return <Calendar size={14} />;
    case 'message': return <MessageSquare size={14} />;
    case 'system': return <Settings2 size={14} />;
  }
}

function getTypeBg(type: AppNotification['type'], dark: boolean) {
  if (dark) {
    switch (type) {
      case 'appointment': return 'bg-blue-900/40 text-blue-400';
      case 'message':     return 'bg-green-900/40 text-green-400';
      case 'system':      return 'bg-amber-900/40 text-amber-400';
    }
  }
  switch (type) {
    case 'appointment': return 'bg-blue-100 text-blue-600';
    case 'message':     return 'bg-green-100 text-green-600';
    case 'system':      return 'bg-amber-100 text-amber-600';
  }
}

function safeFormatDate(val: any) {
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return '';
    return format(d, 'MMM dd, h:mm a');
  } catch {
    return '';
  }
}

export function NotificationBell({ userId, theme = 'light' }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId);

  const dark = theme === 'dark';

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read) markAsRead(n.id);
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-2 rounded-lg transition-colors ${
          dark
            ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
            : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
        }`}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black text-white px-1 shadow-lg ${
            dark ? 'bg-red-500' : 'bg-primary'
          }`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className={`absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-[9999] overflow-hidden border ${
          dark
            ? 'bg-gray-900 border-gray-800'
            : 'bg-white border-border/40'
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${
            dark ? 'border-gray-800' : 'border-border/40'
          }`}>
            <div className="flex items-center gap-2">
              <Bell size={15} className={dark ? 'text-gray-400' : 'text-slate-500'} />
              <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  dark ? 'bg-red-600/20 text-red-400' : 'bg-primary/10 text-primary'
                }`}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                    dark
                      ? 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className={`p-1 rounded-lg transition-colors ${
                  dark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-slate-100 text-slate-400'
                }`}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  dark ? 'bg-gray-800' : 'bg-slate-100'
                }`}>
                  <Bell size={22} className={dark ? 'text-gray-600' : 'text-slate-400'} />
                </div>
                <p className={`text-sm font-semibold ${dark ? 'text-gray-400' : 'text-slate-600'}`}>
                  All caught up!
                </p>
                <p className={`text-xs ${dark ? 'text-gray-600' : 'text-slate-400'}`}>
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b last:border-b-0 ${
                    dark ? 'border-gray-800/60' : 'border-border/20'
                  } ${
                    !n.read
                      ? dark ? 'bg-gray-800/50 hover:bg-gray-800' : 'bg-primary/[0.04] hover:bg-primary/[0.07]'
                      : dark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Icon */}
                  <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${getTypeBg(n.type, dark)}`}>
                    {getTypeIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-bold leading-tight ${dark ? 'text-white' : 'text-slate-800'}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className={`shrink-0 w-2 h-2 rounded-full mt-1 ${dark ? 'bg-red-500' : 'bg-primary'}`} />
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${dark ? 'text-gray-400' : 'text-slate-500'}`}>
                      {n.message}
                    </p>
                    {n.createdAt && (
                      <p className={`text-[10px] mt-1 ${dark ? 'text-gray-600' : 'text-slate-400'}`}>
                        {safeFormatDate(n.createdAt)}
                      </p>
                    )}
                  </div>

                  {/* Read indicator */}
                  {n.read && (
                    <Check size={12} className={`shrink-0 mt-1 ${dark ? 'text-gray-700' : 'text-slate-300'}`} />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
