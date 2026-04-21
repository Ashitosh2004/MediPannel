import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from '@tanstack/react-router';
import { Input, Field, FieldLabel, FieldError } from '@blinkdotnew/ui';
import { ShieldCheck, Mail, ArrowLeft, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type FormData = z.infer<typeof schema>;

export function AdminForgotPassword() {
  const { sendAdminPasswordReset } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    try {
      await sendAdminPasswordReset(data.email);
      setSentEmail(data.email);
      setSent(true);
    } catch (err: any) {
      // Firebase throws auth/user-not-found — show a safe message either way
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        // Still show success state to prevent email enumeration
        setSentEmail(data.email);
        setSent(true);
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setError(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-4 shadow-xl shadow-red-600/30">
            <ShieldCheck className="text-white w-9 h-9" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">MedPanel Pro</h1>
          <p className="text-gray-400 font-medium mt-1 text-sm">Admin Control Center</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-500">

          {!sent ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-600/20 p-2.5 rounded-xl border border-red-600/30">
                  <KeyRound size={20} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Reset Password</h2>
                  <p className="text-gray-400 text-xs mt-0.5">Enter your admin email to receive a reset link</p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Info note */}
              <div className="mb-5 flex items-start gap-3 p-4 bg-gray-800/80 border border-gray-700 rounded-xl">
                <Mail size={16} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  A password reset link will be sent to the registered admin email. The link expires in <span className="font-semibold text-gray-300">1 hour</span>.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Field>
                  <FieldLabel className="text-gray-300 font-semibold text-sm mb-1.5 block">
                    Admin Email Address
                  </FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      <Mail size={16} />
                    </div>
                    <Input
                      {...register('email')}
                      type="email"
                      placeholder="admin@hospital.com"
                      autoComplete="email"
                      className="pl-10 h-12 bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 focus:border-red-500 focus:ring-red-500/20 rounded-xl text-sm"
                    />
                  </div>
                  {errors.email && (
                    <FieldError className="mt-1.5 text-red-400 text-xs">{errors.email.message}</FieldError>
                  )}
                </Field>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-red-600/20"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                      <span>Sending Reset Link...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={17} />
                      <span>Send Reset Link</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Success state */
            <div className="text-center py-4 animate-in zoom-in-95 duration-300 space-y-5">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Check your inbox</h3>
                <p className="text-gray-400 text-sm mt-2">
                  If <span className="text-white font-semibold">{sentEmail}</span> is a registered admin account, a password reset link has been sent.
                </p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-left space-y-2.5">
                <p className="text-xs font-black text-gray-300 uppercase tracking-widest">What to do next:</p>
                <div className="space-y-2">
                  {[
                    'Open the reset email from Firebase / noreply@hospital-management.firebaseapp.com',
                    'Click the "Reset password" link in the email',
                    'Choose a new strong password',
                    'Return here to sign in with your new password',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 bg-red-600/20 text-red-400 rounded-full text-[10px] font-black flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-gray-400 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Didn't receive it?{' '}
                <button
                  onClick={() => { setSent(false); setError(null); }}
                  className="text-red-400 hover:text-red-300 font-semibold transition-colors"
                >
                  Try again
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Back to login */}
        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white font-semibold transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Admin Login
          </Link>
        </div>

        <p className="text-center text-gray-600 text-xs mt-5">
          &copy; {new Date().getFullYear()} MedPanel Pro &mdash; Authorized Access Only
        </p>
      </div>
    </div>
  );
}
