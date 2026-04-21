import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from '@tanstack/react-router';
import { Input, Field, FieldLabel, FieldError } from '@blinkdotnew/ui';
import {
  Stethoscope,
  Mail,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});
type FormData = z.infer<typeof schema>;

export function DoctorForgotPassword() {
  const { sendDoctorPasswordReset } = useDoctorAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    setError(null);
    try {
      await sendDoctorPasswordReset(data.email);
      setSentEmail(data.email);
      setSent(true);
    } catch (err: any) {
      // Prevent email enumeration — show success state for user-not-found too
      if (
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/invalid-email'
      ) {
        setSentEmail(data.email);
        setSent(true);
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please wait a few minutes before trying again.');
      } else {
        setError(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo / Branding */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4 shadow-xl shadow-emerald-600/30">
            <Stethoscope className="text-white w-9 h-9" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">MedPanel Pro</h1>
          <p className="text-slate-400 font-medium mt-1 text-sm">Doctor Portal</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-500">

          {!sent ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-emerald-600/20 p-2.5 rounded-xl border border-emerald-600/30">
                  <KeyRound size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">Reset Password</h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Enter your doctor email to receive a reset link
                  </p>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div className="mb-5 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Info note */}
              <div className="mb-5 flex items-start gap-3 p-4 bg-slate-800/80 border border-slate-700 rounded-xl">
                <Mail size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  A password reset link will be sent to your registered email. The link
                  expires in{' '}
                  <span className="font-semibold text-slate-300">1 hour</span>.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <Field>
                  <FieldLabel className="text-slate-300 font-semibold text-sm mb-1.5 block">
                    Doctor Email Address
                  </FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Mail size={16} />
                    </div>
                    <Input
                      {...register('email')}
                      type="email"
                      placeholder="doctor@hospital.com"
                      autoComplete="email"
                      className="pl-10 h-12 bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl text-sm"
                    />
                  </div>
                  {errors.email && (
                    <FieldError className="mt-1.5 text-red-400 text-xs">
                      {errors.email.message}
                    </FieldError>
                  )}
                </Field>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-emerald-600/20"
                >
                  {submitting ? (
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
            /* ── Success state ─────────────────────────────────────── */
            <div className="text-center py-4 animate-in zoom-in-95 duration-300 space-y-5">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">Check your inbox</h3>
                <p className="text-slate-400 text-sm mt-2">
                  If{' '}
                  <span className="text-white font-semibold">{sentEmail}</span>{' '}
                  is a registered doctor account, a password reset link has been sent.
                </p>
              </div>

              {/* Step-by-step instructions */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-left space-y-2.5">
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">
                  What to do next:
                </p>
                <div className="space-y-2">
                  {[
                    'Open the reset email from noreply@hospital-management-1cb98.firebaseapp.com',
                    'Click the "Reset password" link inside the email',
                    'Choose a new strong password (min. 8 characters)',
                    'Return to the Doctor Login page to sign in',
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 bg-emerald-600/20 text-emerald-400 rounded-full text-[10px] font-black flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-slate-400 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Didn&apos;t receive it?{' '}
                <button
                  onClick={() => { setSent(false); setError(null); }}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
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
            to="/doctor/login"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white font-semibold transition-colors"
          >
            <ArrowLeft size={15} />
            Back to Doctor Login
          </Link>
        </div>

        <p className="text-center text-slate-600 text-xs mt-5">
          &copy; {new Date().getFullYear()} MedPanel Pro &mdash; Authorized Access Only
        </p>
      </div>
    </div>
  );
}
