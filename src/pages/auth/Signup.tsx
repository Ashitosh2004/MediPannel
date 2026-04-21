import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, User, AlertCircle, Sparkles, LogIn } from 'lucide-react';
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

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupSchema = z.infer<typeof signupSchema>;

export function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false);

  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupSchema) => {
    setLoading(true);
    setError(null);
    try {
      await signup(data.email, data.password, data.name);
      setShowVerificationPrompt(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Signup failed. Please try again.');
      toast.error('Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (showVerificationPrompt) {
    return (
      <AuthLayout 
        title="Verify Your Email" 
        subtitle="One last step to get started"
      >
        <div className="text-center space-y-6 py-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-full mb-2 animate-in zoom-in duration-500">
            <Mail size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Check your inbox</h3>
            <p className="text-muted-foreground leading-relaxed">
              We've sent a verification link to your email address. Please check your inbox and click the link to activate your account.
            </p>
          </div>
          <div className="pt-6 space-y-4">
            <Button 
              onClick={() => navigate({ to: '/login' })}
              className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-xl transition-all duration-300"
            >
              Back to Sign In
            </Button>
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder.
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Create Account" 
      subtitle="Join MedPanel Pro patient portal"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {error && (
          <Banner variant="error" className="rounded-xl border-none shadow-sm animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </Banner>
        )}

        <Field>
          <FieldLabel className="text-foreground/80 font-semibold mb-1 ml-1">Full Name</FieldLabel>
          <div className="relative group transition-all duration-300">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
              <User size={18} />
            </div>
            <Input 
              {...register('name')} 
              autoComplete="name"
              placeholder="John Doe" 
              className="pl-12 h-12 bg-white/50 border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
            />
          </div>
          {errors.name && <FieldError className="mt-1 ml-1 font-medium">{errors.name.message}</FieldError>}
        </Field>

        <Field>
          <FieldLabel className="text-foreground/80 font-semibold mb-1 ml-1">Email</FieldLabel>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field>
            <FieldLabel className="text-foreground/80 font-semibold mb-1 ml-1">Password</FieldLabel>
            <div className="relative group transition-all duration-300">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Lock size={18} />
              </div>
              <Input 
                {...register('password')} 
                type="password"
                autoComplete="new-password"
                placeholder="••••••••" 
                className="pl-12 h-12 bg-white/50 border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
              />
            </div>
            {errors.password && <FieldError className="mt-1 ml-1 font-medium">{errors.password.message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel className="text-foreground/80 font-semibold mb-1 ml-1">Confirm</FieldLabel>
            <div className="relative group transition-all duration-300">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Lock size={18} />
              </div>
              <Input 
                {...register('confirmPassword')} 
                type="password"
                autoComplete="new-password"
                placeholder="••••••••" 
                className="pl-12 h-12 bg-white/50 border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
              />
            </div>
            {errors.confirmPassword && <FieldError className="mt-1 ml-1 font-medium">{errors.confirmPassword.message}</FieldError>}
          </Field>
        </div>

        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300"
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
              <span>Creating...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles size={20} />
              <span>Create Account</span>
            </div>
          )}
        </Button>
      </form>

      <div className="mt-10 text-center pt-8 border-t border-border/40">
        <p className="text-muted-foreground font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-bold hover:underline underline-offset-4 decoration-2">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
