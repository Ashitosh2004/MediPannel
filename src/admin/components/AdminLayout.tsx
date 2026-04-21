import React, { useState } from 'react';
import { Link, useRouterState, useNavigate } from '@tanstack/react-router';
import {
  LayoutDashboard, Stethoscope, Calendar, Users, Clock,
  MessageSquare, Bot, User, Settings, FileText, LogOut,
  ShieldCheck, ChevronLeft, Menu, X, Bell
} from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { toast } from 'react-hot-toast';
import { NotificationBell } from '../../components/NotificationBell';

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin' },
  { icon: Stethoscope, label: 'Doctors', href: '/admin/doctors' },
  { icon: Calendar, label: 'Appointments', href: '/admin/appointments' },
  { icon: Users, label: 'Patients', href: '/admin/patients' },
  { icon: Clock, label: 'Availability', href: '/admin/availability' },
  { icon: MessageSquare, label: 'Messages', href: '/admin/messages' },
  { icon: Bot, label: 'ChatBot', href: '/admin/chatbot' },
  { icon: FileText, label: 'Audit Logs', href: '/admin/audit-logs' },
];

const BOTTOM_ITEMS = [
  { icon: User, label: 'Profile', href: '/admin/profile' },
  { icon: Settings, label: 'Settings', href: '/admin/settings' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { adminData, logout } = useAdminAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out');
      navigate({ to: '/admin/login' });
    } catch { toast.error('Failed to sign out'); }
  };

  const NavItem = ({ icon: Icon, label, href }: { icon: any; label: string; href: string }) => {
    const active = currentPath === href;
    return (
      <Link to={href} onClick={() => setMobileSidebarOpen(false)}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group ${
          active
            ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
        }`}>
          <Icon size={18} className={active ? 'text-white' : 'text-gray-500 group-hover:text-white'} />
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800 w-64">
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-3 border-b border-gray-800">
        <div className="bg-red-600 p-2 rounded-xl">
          <ShieldCheck size={22} className="text-white" />
        </div>
        <div>
          <div className="font-black text-white text-sm tracking-tight">MedPanel Pro</div>
          <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Admin Portal</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="px-3 mb-3 text-[10px] font-black text-gray-600 uppercase tracking-widest">Management</p>
        {NAV_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
        <div className="pt-4 mt-4 border-t border-gray-800">
          <p className="px-3 mb-3 text-[10px] font-black text-gray-600 uppercase tracking-widest">Account</p>
          {BOTTOM_ITEMS.map(item => <NavItem key={item.href} {...item} />)}
        </div>
      </div>

      {/* User */}
      <div className="px-3 pb-4 border-t border-gray-800 pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-900 mb-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0">
            {adminData?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">{adminData?.name || 'Administrator'}</div>
            <div className="text-[10px] text-gray-500 truncate">{adminData?.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-all"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 h-full"><Sidebar /></div>
          <div className="flex-1 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-800 text-gray-400"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            >
              {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="hidden md:block">
              <span className="text-white font-semibold text-sm">
                {NAV_ITEMS.concat(BOTTOM_ITEMS).find(n => n.href === currentPath)?.label || 'Admin Portal'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-2 py-1 bg-red-900/30 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-800/40">
              Super Admin
            </div>
            {adminData && <NotificationBell userId={adminData.uid} theme="dark" />}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
