import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from '@tanstack/react-router';
import { toast } from 'react-hot-toast';
import { Input, Field, FieldLabel, FieldError } from '@blinkdotnew/ui';
import { ShieldCheck, Lock, Mail, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
type FormData = z.infer<typeof schema>;

export function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError(null);
    try {
      await login(data.email, data.password);
      toast.success('Welcome, Administrator');
      navigate({ to: '/admin' });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
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
          <h2 className="text-xl font-black text-white mb-1">Administrator Login</h2>
          <p className="text-gray-400 text-sm mb-7">Restricted access — authorized personnel only.</p>

          {/* Error banner */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400 leading-relaxed whitespace-pre-line">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <Field>
              <FieldLabel className="text-gray-300 font-semibold text-sm mb-1.5 block">
                Email Address
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

            {/* Password */}
            <Field>
              <FieldLabel className="text-gray-300 font-semibold text-sm mb-1.5 block">
                Password
              </FieldLabel>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                  <Lock size={16} />
                </div>
                <Input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-10 pr-12 h-12 bg-gray-800 border-gray-700 text-white placeholder:text-gray-600 focus:border-red-500 focus:ring-red-500/20 rounded-xl text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <FieldError className="mt-1.5 text-red-400 text-xs">{errors.password.message}</FieldError>
              )}
            </Field>

            {/* Forgot password */}
            <div className="flex justify-end -mt-1">
              <Link
                to="/admin/forgot-password"
                className="text-xs text-gray-400 hover:text-red-400 font-semibold transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-red-600/20 mt-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-8">
          &copy; {new Date().getFullYear()} MedPanel Pro &mdash; Authorized Access Only
        </p>
      </div>
    </div>
  );
}
