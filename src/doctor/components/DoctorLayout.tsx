import React, { useState } from 'react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Stethoscope,
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  Clock,
  MessageSquare,
  UserCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
} from 'lucide-react';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { toast } from 'react-hot-toast';
import { NotificationBell } from '../../components/NotificationBell';
import { DoctorChatBot } from './DoctorChatBot';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation definitions
// ─────────────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     icon: LayoutDashboard, href: '/doctor' },
  { label: 'Appointments',  icon: CalendarDays,    href: '/doctor/appointments' },
  { label: 'Patients',      icon: Users,           href: '/doctor/patients' },
  { label: 'Prescriptions', icon: FileText,        href: '/doctor/prescriptions' },
  { label: 'Availability',  icon: Clock,           href: '/doctor/availability' },
  { label: 'Messages',      icon: MessageSquare,   href: '/doctor/messages' },
  { label: 'Profile',       icon: UserCircle,      href: '/doctor/profile' },
  { label: 'Settings',      icon: Settings,        href: '/doctor/settings' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isActive(currentPath: string, href: string): boolean {
  if (href === '/doctor') return currentPath === '/doctor';
  return currentPath.startsWith(href);
}

function getInitials(name?: string): string {
  if (!name) return 'DR';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getPageTitle(pathname: string): string {
  const match = NAV_ITEMS.find((item) => isActive(pathname, item.href));
  return match?.label ?? 'Doctor Portal';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar content — shared between desktop and mobile
// ─────────────────────────────────────────────────────────────────────────────

interface SidebarContentProps {
  currentPath: string;
  doctorName?: string;
  doctorEmail?: string;
  onNavClick?: () => void;
  onLogout: () => void;
}

function SidebarContent({
  currentPath,
  doctorName,
  doctorEmail,
  onNavClick,
  onLogout,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64">
      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50">
          <Stethoscope size={20} className="text-emerald-600" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-bold text-slate-800 text-sm tracking-tight">MedPanel Pro</span>
          <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 w-fit">
            Doctor Portal
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(currentPath, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavClick}
              className="block"
            >
              <div
                className={[
                  'flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 rounded-lg',
                  active
                    ? 'bg-emerald-50 text-emerald-700 font-semibold border-r-2 border-emerald-600 rounded-r-none'
                    : 'text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900',
                ].join(' ')}
              >
                <Icon
                  size={17}
                  className={active ? 'text-emerald-600 shrink-0' : 'text-slate-400 shrink-0'}
                />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom: doctor info + logout ── */}
      <div className="shrink-0 px-3 py-4 border-t border-slate-200 space-y-1">
        {/* Doctor identity card */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs shrink-0 select-none">
            {getInitials(doctorName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {doctorName ?? 'Doctor'}
            </p>
            {doctorEmail && (
              <p className="text-[10px] text-slate-400 truncate">{doctorEmail}</p>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOut size={16} className="shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoctorLayout
// ─────────────────────────────────────────────────────────────────────────────

interface DoctorLayoutProps {
  children: React.ReactNode;
}

export function DoctorLayout({ children }: DoctorLayoutProps) {
  const { doctorUser, doctorData, logout } = useDoctorAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully');
      navigate({ to: '/doctor/login' });
    } catch {
      toast.error('Failed to sign out');
    }
  };

  const pageTitle = getPageTitle(currentPath);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex md:flex-col w-64 h-screen shrink-0">
        <SidebarContent
          currentPath={currentPath}
          doctorName={doctorData?.name}
          doctorEmail={doctorData?.email}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Sidebar panel */}
          <div className="w-64 h-full shadow-xl">
            <SidebarContent
              currentPath={currentPath}
              doctorName={doctorData?.name}
              doctorEmail={doctorData?.email}
              onNavClick={() => setMobileSidebarOpen(false)}
              onLogout={handleLogout}
            />
          </div>
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
        </div>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 gap-4 shrink-0">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
            onClick={() => setMobileSidebarOpen((prev) => !prev)}
            aria-label="Toggle sidebar"
          >
            {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Page title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-slate-800 truncate">{pageTitle}</h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Notifications bell */}
            {doctorUser && <NotificationBell userId={doctorUser.uid} theme="light" />}

            {/* Doctor name (desktop) */}
            <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[140px] truncate">
              {doctorData?.name ?? 'Doctor'}
            </span>

            {/* Avatar */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs select-none shrink-0">
              {getInitials(doctorData?.name)}
            </div>

            {/* Logout (desktop) */}
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
              title="Sign out"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>

        {/* AI Chat Assistant */}
        <DoctorChatBot />
      </div>
    </div>
  );
}
