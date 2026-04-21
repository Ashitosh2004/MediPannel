import React from 'react';
import { Pill } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4 transition-colors duration-300">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-primary/10 rounded-3xl p-4 mb-4 ring-2 ring-primary/20">
            <Pill className="text-primary w-10 h-10" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">MedPanel Pro</h1>
          <p className="text-muted-foreground mt-2 font-medium">Advanced Patient Portal</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-3xl p-10 shadow-2xl shadow-black/10 dark:shadow-black/40 animate-in zoom-in-95 duration-500">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
            {subtitle && <p className="text-muted-foreground text-sm font-medium">{subtitle}</p>}
          </div>
          {children}
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground animate-in fade-in duration-1000 delay-500">
          &copy; {new Date().getFullYear()} MedPanel Pro Healthcare Solutions. All rights reserved.
        </div>
      </div>
    </div>
  );
}
