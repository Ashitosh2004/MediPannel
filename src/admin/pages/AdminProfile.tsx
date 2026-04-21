import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Mail, ShieldCheck, Save } from 'lucide-react';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});
type FormData = z.infer<typeof schema>;

export function AdminProfile() {
  const { adminUser, adminData, refreshAdminData } = useAdminAuth();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    defaultValues: { name: adminData?.name || '' },
  });

  const onSubmit = async (data: FormData) => {
    if (!adminUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'admins', adminUser.uid), { name: data.name, updatedAt: new Date().toISOString() });
      await refreshAdminData();
      toast.success('Profile updated');
    } catch (err) { console.error(err); toast.error('Failed to update profile'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">Admin Profile</h1>
        <p className="text-gray-400 text-sm mt-0.5">Manage your administrator account details.</p>
      </div>

      {/* Avatar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black">
            {adminData?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div>
            <div className="text-xl font-black text-white">{adminData?.name || 'Administrator'}</div>
            <div className="text-gray-400 text-sm mt-0.5">{adminData?.email}</div>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-red-900/30 text-red-400 border border-red-800/40 rounded-lg text-xs font-black uppercase tracking-widest">
              <ShieldCheck size={12} />
              Super Admin
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <h3 className="text-sm font-bold text-white border-b border-gray-800 pb-3">Personal Information</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Display Name</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"><User size={16} /></div>
              <input {...register('name')} className="pl-10 w-full h-11 bg-gray-800 border border-gray-700 text-white rounded-xl text-sm focus:outline-none focus:border-red-500" placeholder="Your name" />
            </div>
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Email Address</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"><Mail size={16} /></div>
              <input value={adminUser?.email || ''} disabled className="pl-10 w-full h-11 bg-gray-800/50 border border-gray-700 text-gray-500 rounded-xl text-sm cursor-not-allowed" />
            </div>
            <p className="text-xs text-gray-600 mt-1">Email cannot be changed from this portal.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Role</label>
            <div className="h-11 px-4 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-gray-500 flex items-center">
              {adminData?.role || 'super_admin'}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isDirty}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all active:scale-95"
          >
            {loading ? <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> : <Save size={15} />}
            <span>Save Changes</span>
          </button>
        </form>
      </div>
    </div>
  );
}
