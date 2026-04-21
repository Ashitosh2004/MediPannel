import React from 'react';
import { useNavigate, Outlet } from '@tanstack/react-router';
import { useAuth } from '../../contexts/AuthContext';
import { AppLayout } from '../layout/AppLayout';
import { PatientOnboarding } from './PatientOnboarding';

export function ProtectedRoute({ children }: { children?: React.ReactNode }) {
  const { user, userData, loading, refreshUserData } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/login' });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary shadow-lg shadow-primary/20"></div>
            <div className="absolute inset-0 animate-ping opacity-20 rounded-full h-16 w-16 bg-primary"></div>
          </div>
          <span className="text-muted-foreground font-semibold animate-pulse tracking-wide uppercase text-xs">
            MedPanel Pro Loading
          </span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ── Onboarding gate ─────────────────────────────────────────────────────
  // If userData exists (Firestore doc present) but profile is not complete,
  // force the onboarding form. New users after signup will have profileComplete = undefined.
  if (userData && userData.profileComplete !== true) {
    return (
      <PatientOnboarding
        onComplete={async () => {
          // Refresh userData so the gate re-evaluates and lets the user through
          await refreshUserData();
        }}
      />
    );
  }

  return (
    <AppLayout>
      {children || <Outlet />}
    </AppLayout>
  );
}
