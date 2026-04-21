import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from '@tanstack/react-router';
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

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm<ForgotPasswordSchema>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordSchema) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await resetPassword(data.email);
      setSuccess(true);
      toast.success('If that email exists, a reset link has been sent!');
    } catch (err: any) {
      console.error(err);
      // Surface only actionable errors; hide user-not-found for security
      if (err.message?.includes('Too many requests') || err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes before trying again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        // For unknown errors, still show success to prevent user enumeration
        setSuccess(true);
      }
      if (!success) toast.error('Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Reset Password" 
      subtitle="We'll send you a link to reset your password"
    >
      {!success ? (
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
            <FieldLabel className="text-foreground/80 font-semibold mb-1 ml-1">Email</FieldLabel>
            <div className="relative group transition-all duration-300">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Mail size={18} />
              </div>
              <Input 
                {...register('email')} 
                placeholder="name@example.com" 
                className="pl-12 h-12 bg-white/50 border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
              />
            </div>
            {errors.email && <FieldError className="mt-1 ml-1 font-medium">{errors.email.message}</FieldError>}
          </Field>

          <Button 
            type="submit" 
            disabled={loading} 
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] transition-all duration-300"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></div>
                <span>Sending...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Send size={20} />
                <span>Send Reset Link</span>
              </div>
            )}
          </Button>

          <div className="text-center pt-4">
            <Link to="/login" className="inline-flex items-center text-sm font-bold text-muted-foreground hover:text-primary transition-colors group">
              <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Sign In
            </Link>
          </div>
        </form>
      ) : (
        <div className="text-center space-y-6 py-4 animate-in zoom-in-95 duration-500">
          <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto ring-8 ring-green-50/50 mb-6">
            <CheckCircle className="text-green-500 w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-foreground">Email Sent!</h3>
            <p className="text-muted-foreground font-medium leading-relaxed">
              Check your inbox for a link to reset your password. If you don't see it, check your spam folder.
            </p>
          </div>
          <Button asChild className="w-full h-12 rounded-xl" variant="outline">
             <Link to="/login" className="flex items-center gap-2">
                <ArrowLeft size={18} />
                <span>Return to Login</span>
             </Link>
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
