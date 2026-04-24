import React from 'react';
import { 
  AppShell, 
  AppShellSidebar, 
  AppShellMain, 
  MobileSidebarTrigger, 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarItem, 
  SidebarFooter,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Button
} from '@blinkdotnew/ui';
import { 
  LayoutDashboard, 
  Calendar, 
  FileText, 
  Pill, 
  MessageSquare, 
  User, 
  Settings, 
  HelpCircle,
  LogOut,
  Lock,
} from 'lucide-react';
import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { useAuth } from '../../contexts/AuthContext';
import { ChatBot } from '../ChatBot';
import { NotificationBell } from '../NotificationBell';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, logout } = useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const handleLogout = async () => {
    try {
      await logout();
      navigate({ to: '/login' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', href: '/' },
    { icon: <Calendar size={20} />, label: 'Appointments', href: '/appointments' },
    { icon: <FileText size={20} />, label: 'Medical Records', href: '/records' },
    { icon: <Lock size={20} />, label: 'MedLocker', href: '/medlocker' },
    { icon: <Pill size={20} />, label: 'Prescriptions', href: '/prescriptions' },
    { icon: <MessageSquare size={20} />, label: 'Messages', href: '/messages' },
  ];

  const bottomItems = [
    { icon: <User size={20} />, label: 'Profile', href: '/profile' },
    { icon: <Settings size={20} />, label: 'Settings', href: '/settings' },
    { icon: <HelpCircle size={20} />, label: 'Help Center', href: '/help' },
  ];

  return (
    <AppShell>
      <AppShellSidebar>
        <Sidebar>
          <SidebarHeader className="flex items-center gap-3 px-4 py-6">
            <div className="bg-primary rounded-xl p-2">
              <Pill className="text-white" size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight text-primary">MedPanel Pro</span>
          </SidebarHeader>
          
          <SidebarContent className="flex-1 px-2 space-y-1">
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Menu
              </SidebarGroupLabel>
              {menuItems.map((item) => (
                <Link key={item.href} to={item.href}>
                  <SidebarItem 
                    icon={item.icon} 
                    label={item.label} 
                    active={currentPath === item.href}
                    className="rounded-xl transition-all duration-200"
                  />
                </Link>
              ))}
            </SidebarGroup>

            <SidebarGroup className="mt-8">
              <SidebarGroupLabel className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                System
              </SidebarGroupLabel>
              {bottomItems.map((item) => (
                <Link key={item.href} to={item.href}>
                  <SidebarItem 
                    icon={item.icon} 
                    label={item.label} 
                    active={currentPath === item.href}
                    className="rounded-xl transition-all duration-200"
                  />
                </Link>
              ))}
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 mt-auto border-t border-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 hover:bg-accent rounded-xl transition-all duration-200">
                  <Avatar className="h-9 w-9 border-2 border-primary/20">
                    <AvatarImage src={userData?.profileImage} />
                    <AvatarFallback>{userData?.name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="text-sm font-semibold truncate w-full text-foreground">
                      {userData?.name || 'User'}
                    </span>
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {user?.email}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                <DropdownMenuLabel className="font-semibold text-sm">Account</DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem onClick={() => navigate({ to: '/profile' })} className="rounded-lg cursor-pointer">
                  <User className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: '/settings' })} className="rounded-lg cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive rounded-lg cursor-pointer hover:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
      </AppShellSidebar>

      <AppShellMain className="bg-background">
        <div className="md:hidden flex items-center justify-between px-4 h-16 border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2">
            <MobileSidebarTrigger />
            <span className="font-bold text-lg text-primary">MedPanel</span>
          </div>
          {user && <NotificationBell userId={user.uid} theme="light" />}
        </div>
        
        <header className="hidden md:flex items-center justify-end px-8 h-16 bg-card/80 backdrop-blur-sm sticky top-0 z-40 border-b border-border">
           <div className="flex items-center gap-4">
              {user && <NotificationBell userId={user.uid} theme="light" />}
           </div>
        </header>

        <main className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
        <ChatBot />
      </AppShellMain>
    </AppShell>
  );
}
