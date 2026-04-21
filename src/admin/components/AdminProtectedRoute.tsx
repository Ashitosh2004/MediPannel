import React, { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { AdminLayout } from './AdminLayout';
import { ShieldCheck } from 'lucide-react';

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { adminUser, adminData, loading } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!adminUser || !adminData)) {
      navigate({ to: '/admin/login' });
    }
  }, [adminUser, adminData, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="bg-red-600/20 border border-red-600/30 p-5 rounded-2xl">
            <ShieldCheck className="text-red-400 w-10 h-10" />
          </div>
          <div className="animate-spin h-7 w-7 border-2 border-gray-700 border-t-red-500 rounded-full" />
          <span className="text-gray-500 text-xs font-bold uppercase tracking-widest">Verifying Admin Access</span>
        </div>
      </div>
    );
  }

  if (!adminUser || !adminData) return null;

  return <AdminLayout>{children}</AdminLayout>;
}
