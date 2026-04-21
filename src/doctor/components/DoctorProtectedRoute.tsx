import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { Stethoscope } from 'lucide-react';

export function DoctorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { doctorUser, doctorData, loading } = useDoctorAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!doctorUser || !doctorData)) {
      navigate({ to: '/doctor/login' });
    }
  }, [doctorUser, doctorData, loading, navigate]);

  // ── Loading spinner ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="bg-emerald-600/20 border border-emerald-600/30 p-5 rounded-2xl">
            <Stethoscope className="text-emerald-400 w-10 h-10" />
          </div>
          <div className="animate-spin h-7 w-7 border-2 border-slate-700 border-t-emerald-500 rounded-full" />
          <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">
            Verifying Doctor Access
          </span>
        </div>
      </div>
    );
  }

  // Not authenticated — render nothing (redirect handled by useEffect above)
  if (!doctorUser || !doctorData) return null;

  // Authenticated — render children directly (layout is added per-page)
  return <>{children}</>;
}
