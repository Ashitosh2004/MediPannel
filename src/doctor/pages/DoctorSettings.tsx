import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, Bell, Smartphone, Mail, Shield, Info, Save } from 'lucide-react';
import { format } from 'date-fns';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface NotificationPrefs {
  emailReminders: boolean;
  appointmentAlerts: boolean;
  messageNotifications: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailReminders: true,
  appointmentAlerts: true,
  messageNotifications: true,
};

// ─── Toggle sub-component ─────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        value ? 'bg-emerald-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCreatedAt(ts: any): string {
  if (!ts) return '—';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return format(date, 'MMM dd, yyyy · h:mm a');
  } catch {
    return '—';
  }
}

function mapPasswordError(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Current password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/weak-password':
      return 'New password is too weak. Use at least 8 characters.';
    case 'auth/requires-recent-login':
      return 'Please sign out and sign in again before changing your password.';
    default:
      return 'Failed to update password. Please try again.';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DoctorSettings() {
  const { doctorUser, doctorData } = useDoctorAuth();

  // ── Password form ─────────────────────────────────────────────────────────
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset: resetPassword,
    formState: { errors: pwErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (!auth.currentUser || !doctorData?.email) return;
    setPasswordLoading(true);
    try {
      const credential = EmailAuthProvider.credential(
        doctorData.email,
        data.currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, data.newPassword);
      toast.success('Password updated successfully');
      resetPassword();
    } catch (err: any) {
      toast.error(mapPasswordError(err.code as string));
    } finally {
      setPasswordLoading(false);
    }
  };

  // ── Notification prefs ────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  useEffect(() => {
    if (!doctorUser?.uid) return;
    getDoc(doc(db, 'doctor_preferences', doctorUser.uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.notifications) {
            setPrefs({ ...DEFAULT_PREFS, ...data.notifications });
          }
        }
      })
      .catch(() => {})
      .finally(() => setPrefsLoading(false));
  }, [doctorUser?.uid]);

  const handleTogglePref = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePrefs = async () => {
    if (!doctorUser?.uid) return;
    setPrefsSaving(true);
    try {
      await setDoc(
        doc(db, 'doctor_preferences', doctorUser.uid),
        { notifications: prefs },
        { merge: true }
      );
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account security and preferences.</p>
      </div>

      {/* ── Section 1: Change Password ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-700">Change Password</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            You'll be re-authenticated with your current password before making changes.
          </p>
        </div>

        <form onSubmit={handleSubmit(onPasswordSubmit)} className="p-6 space-y-5">
          {/* Current password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Lock size={15} />
              </div>
              <input
                {...register('currentPassword')}
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                className="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwErrors.currentPassword && (
              <p className="text-red-500 text-xs mt-1">{pwErrors.currentPassword.message}</p>
            )}
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              New Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Lock size={15} />
              </div>
              <input
                {...register('newPassword')}
                type={showNew ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                className="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwErrors.newPassword && (
              <p className="text-red-500 text-xs mt-1">{pwErrors.newPassword.message}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Lock size={15} />
              </div>
              <input
                {...register('confirmPassword')}
                type={showConfirm ? 'text' : 'password'}
                placeholder="Re-enter new password"
                className="w-full border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {pwErrors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{pwErrors.confirmPassword.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={passwordLoading}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2"
          >
            {passwordLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={15} />
            )}
            Update Password
          </button>
        </form>
      </div>

      {/* ── Section 2: Notification Preferences ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-700">Notification Preferences</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Choose which notifications you'd like to receive.
          </p>
        </div>

        {prefsLoading ? (
          <div className="p-10 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {/* Email reminders */}
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50">
                  <Mail size={16} className="text-slate-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">Email Reminders</div>
                  <div className="text-xs text-slate-400">
                    Receive daily appointment summaries via email
                  </div>
                </div>
              </div>
              <Toggle
                value={prefs.emailReminders}
                onChange={() => handleTogglePref('emailReminders')}
              />
            </div>

            {/* Appointment alerts */}
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50">
                  <Smartphone size={16} className="text-slate-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">Appointment Alerts</div>
                  <div className="text-xs text-slate-400">
                    Get notified when appointments are booked or cancelled
                  </div>
                </div>
              </div>
              <Toggle
                value={prefs.appointmentAlerts}
                onChange={() => handleTogglePref('appointmentAlerts')}
              />
            </div>

            {/* Message notifications */}
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-50">
                  <Bell size={16} className="text-slate-500" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">Message Notifications</div>
                  <div className="text-xs text-slate-400">
                    Receive alerts when patients send you messages
                  </div>
                </div>
              </div>
              <Toggle
                value={prefs.messageNotifications}
                onChange={() => handleTogglePref('messageNotifications')}
              />
            </div>

            {/* Save button */}
            <div className="px-6 py-4">
              <button
                type="button"
                onClick={handleSavePrefs}
                disabled={prefsSaving}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2"
              >
                {prefsSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Account Info (readonly) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-700">Account Information</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Read-only details about your doctor account.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} className="text-slate-400" />
                  Email Address
                </span>
              </label>
              <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-500 select-all truncate">
                {doctorData?.email ?? '—'}
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Shield size={13} className="text-slate-400" />
                  Role
                </span>
              </label>
              <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-500 capitalize">
                {doctorData?.role ?? 'doctor'}
              </div>
            </div>

            {/* UID */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Info size={13} className="text-slate-400" />
                  User ID (UID)
                </span>
              </label>
              <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-4 py-2.5 text-xs text-slate-400 font-mono truncate select-all">
                {doctorUser?.uid ?? '—'}
              </div>
            </div>

            {/* Created at */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <Info size={13} className="text-slate-400" />
                  Account Created
                </span>
              </label>
              <div className="w-full border border-slate-100 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-500">
                {formatCreatedAt(doctorData?.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
