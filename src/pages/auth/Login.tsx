import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { toast } from 'react-hot-toast';
import { 
  Button, 
  Input, 
  Field, 
  FieldLabel, 
  FieldError, 
  Banner
} from '@blinkdotnew/ui';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../contexts/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginSchema = z.infer<typeof loginSchema>;

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginSchema) => {
    setLoading(true);
    setError(null);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      navigate({ to: '/' });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Login failed. Please check your credentials.');
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Sign in to your patient account"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Banner variant="error" className="rounded-xl border-none shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </Banner>
        )}

        <Field>
          <FieldLabel className="text-foreground/80 font-semibold mb-1.5 ml-1">Email</FieldLabel>
          <div className="relative group transition-all duration-300">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <Mail size={18} />
            </div>
            <Input 
              {...register('email')} 
              type="email"
              autoComplete="email"
              placeholder="name@example.com" 
              className="pl-12 h-12 bg-white/50 border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
            />
          </div>
          {errors.email && <FieldError className="mt-1 ml-1 font-medium">{errors.email.message}</FieldError>}
        </Field>

        <Field>
          <div className="flex justify-between items-center mb-1.5 ml-1">
            <FieldLabel className="text-foreground/80 font-semibold">Password</FieldLabel>
            <Link to="/forgot-password" title="Forgot password?" className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">
              Forgot?
            </Link>
          </div>
          <div className="relative group transition-all duration-300">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <Lock size={18} />
            </div>
            <Input 
              {...register('password')} 
              type="password"
              autoComplete="current-password"
              placeholder="••••••••" 
              className="pl-12 h-12 bg-white/50 border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
            />
          </div>
          {errors.password && <FieldError className="mt-1 ml-1 font-medium">{errors.password.message}</FieldError>}
        </Field>

        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
              <span>Signing in...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <LogIn size={20} />
              <span>Sign In</span>
            </div>
          )}
        </Button>
      </form>

      <div className="mt-10 text-center pt-8 border-t border-border/40">
        <p className="text-muted-foreground font-medium">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary font-bold hover:underline underline-offset-4 decoration-2">
            Create account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
