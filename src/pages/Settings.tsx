import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Input, 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Field,
  FieldLabel,
  FieldError,
  Badge,
  Banner
} from '@blinkdotnew/ui';
import { 
  Bell, 
  Lock, 
  Eye, 
  Shield, 
  Palette, 
  Smartphone, 
  Mail, 
  CheckCircle2, 
  AlertCircle,
  EyeOff,
  Moon,
  Sun,
  Laptop,
  LogOut,
  Trash2
} from 'lucide-react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, ThemeMode, AccentColor } from '../contexts/ThemeContext';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type PasswordForm = z.infer<typeof passwordSchema>;

interface NotifPrefs {
  emailReminders: boolean;
  pushNotifications: boolean;
  prescriptionRefills: boolean;
  newsletter: boolean;
}

const DEFAULT_NOTIFS: NotifPrefs = {
  emailReminders: true,
  pushNotifications: true,
  prescriptionRefills: true,
  newsletter: false,
};

export function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { mode: themeMode, accent: themeAccent, setMode: setThemeMode, setAccent: setThemeAccent } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notifs, setNotifs] = useState<NotifPrefs>(DEFAULT_NOTIFS);
  const [savingNotifs, setSavingNotifs] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  // Load notification preferences from Firestore
  useEffect(() => {
    if (!user) return;
    const docRef = doc(db, 'user_preferences', user.uid);
    getDoc(docRef).then(snap => {
      if (snap.exists() && snap.data().notifications) {
        setNotifs({ ...DEFAULT_NOTIFS, ...snap.data().notifications });
      }
    }).catch(console.error);
  }, [user]);

  const handleNotifChange = async (key: keyof NotifPrefs, value: boolean) => {
    if (!user) return;
    const updated = { ...notifs, [key]: value };
    setNotifs(updated);
    setSavingNotifs(true);
    try {
      await setDoc(doc(db, 'user_preferences', user.uid), { notifications: updated }, { merge: true });
      toast.success('Preference saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save preference');
      setNotifs(notifs); // revert
    } finally {
      setSavingNotifs(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      toast.success('Password updated successfully!');
      reset();
    } catch (err: any) {
      console.error(err);
      const msg =
        err.code === 'auth/wrong-password'
          ? 'Current password is incorrect.'
          : err.code === 'auth/requires-recent-login'
          ? 'Session expired. Please log out and log back in.'
          : err.message || 'Failed to update password';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate({ to: '/login' });
    } catch {
      toast.error('Failed to log out');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Settings</h1>
        <p className="text-muted-foreground font-medium mt-1">Manage your account security and portal preferences.</p>
      </div>

      <Tabs defaultValue="security" className="space-y-8">
        <TabsList className="bg-muted/50 p-1.5 rounded-2xl ring-1 ring-border w-full sm:w-fit">
          <TabsTrigger value="security" className="rounded-xl px-6 py-2.5 font-bold flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all text-sm">
            <Lock size={15} />
            <span>Security</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-xl px-6 py-2.5 font-bold flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all text-sm">
            <Bell size={15} />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-xl px-6 py-2.5 font-bold flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all text-sm">
            <Palette size={15} />
            <span>Appearance</span>
          </TabsTrigger>
        </TabsList>

        {/* SECURITY TAB */}
        <TabsContent value="security" className="animate-in fade-in duration-500">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Change Password */}
            <Card className="lg:col-span-2 border border-border bg-card shadow-sm overflow-hidden">
              <CardHeader className="p-6 border-b border-border bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <Shield size={20} />
                  </div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Change Password</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-5 max-w-md">
                  <Field>
                    <FieldLabel className="text-foreground font-semibold mb-1.5">Current Password</FieldLabel>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        <Lock size={16} />
                      </div>
                      <Input 
                        {...register('currentPassword')} 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="Enter current password"
                        className="pl-10 pr-12 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.currentPassword && <FieldError className="mt-1">{errors.currentPassword.message}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel className="text-foreground font-semibold mb-1.5">New Password</FieldLabel>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        <Lock size={16} />
                      </div>
                      <Input 
                        {...register('newPassword')} 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="Min. 6 characters"
                        className="pl-10 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                      />
                    </div>
                    {errors.newPassword && <FieldError className="mt-1">{errors.newPassword.message}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel className="text-foreground font-semibold mb-1.5">Confirm New Password</FieldLabel>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                        <Lock size={16} />
                      </div>
                      <Input 
                        {...register('confirmPassword')} 
                        type={showPassword ? 'text' : 'password'} 
                        placeholder="Repeat new password"
                        className="pl-10 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                      />
                    </div>
                    {errors.confirmPassword && <FieldError className="mt-1">{errors.confirmPassword.message}</FieldError>}
                  </Field>

                  <Button 
                    type="submit" 
                    disabled={loading} 
                    className="w-full h-12 rounded-xl font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"></div>
                        <span>Updating...</span>
                      </div>
                    ) : 'Update Password'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Account Security */}
              <Card className="border border-border bg-card shadow-sm">
                <CardHeader className="p-5 border-b border-border bg-muted/30">
                  <CardTitle className="text-base font-bold flex items-center gap-3 text-card-foreground">
                    <Shield className="text-primary w-4 h-4" />
                    Account Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Two-Factor Auth</h4>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">SMS / Auth App</p>
                    </div>
                    <Switch 
                      className="data-[state=checked]:bg-primary"
                      onCheckedChange={(v) => toast(v ? '2FA enabled (coming soon)' : '2FA disabled')}
                    />
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Session Alerts</h4>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email on new login</p>
                    </div>
                    <Switch 
                      defaultChecked
                      className="data-[state=checked]:bg-primary"
                      onCheckedChange={(v) => toast(v ? 'Session alerts on' : 'Session alerts off')}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Sign Out */}
              <Card className="border border-border bg-card shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <h4 className="text-sm font-bold text-foreground">Session</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">Signed in as <span className="font-semibold text-foreground">{user?.email}</span></p>
                  <Button 
                    variant="outline"
                    onClick={handleLogout}
                    className="w-full h-11 rounded-xl font-bold border-border hover:bg-muted flex items-center gap-2 text-sm"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </Button>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border border-destructive/30 bg-destructive/5 shadow-sm">
                <CardHeader className="p-5 border-b border-destructive/20">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    Danger Zone
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                    Permanently delete your account and all associated medical records. This action cannot be undone.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full h-10 rounded-xl font-bold border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all text-sm flex items-center gap-2"
                    onClick={() => toast.error('Account deletion requires contacting support.')}
                  >
                    <Trash2 size={14} />
                    Delete Account
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* NOTIFICATIONS TAB */}
        <TabsContent value="notifications" className="animate-in fade-in duration-500">
          <Card className="border border-border bg-card shadow-sm overflow-hidden max-w-3xl">
            <CardHeader className="p-6 border-b border-border bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                  <Bell size={20} />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-card-foreground">Notification Preferences</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">Changes are saved automatically to your account.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {savingNotifs && (
                <div className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 animate-pulse">
                  <div className="animate-spin h-3 w-3 border border-primary/30 border-t-primary rounded-full"></div>
                  Saving preferences...
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Appointment Reminders</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-5 bg-muted/40 rounded-2xl ring-1 ring-border">
                    <div className="flex items-center gap-4">
                      <div className="bg-background p-2.5 rounded-xl shadow-sm ring-1 ring-border">
                        <Mail size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground">Email Notifications</span>
                        <p className="text-[10px] text-muted-foreground font-medium">Reminders sent to {user?.email}</p>
                      </div>
                    </div>
                    <Switch 
                      checked={notifs.emailReminders}
                      onCheckedChange={(v) => handleNotifChange('emailReminders', v)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between p-5 bg-muted/40 rounded-2xl ring-1 ring-border">
                    <div className="flex items-center gap-4">
                      <div className="bg-background p-2.5 rounded-xl shadow-sm ring-1 ring-border">
                        <Smartphone size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground">Push Notifications</span>
                        <p className="text-[10px] text-muted-foreground font-medium">In-app and browser notifications</p>
                      </div>
                    </div>
                    <Switch 
                      checked={notifs.pushNotifications}
                      onCheckedChange={(v) => handleNotifChange('pushNotifications', v)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Healthcare Updates</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-5 bg-muted/40 rounded-2xl ring-1 ring-border">
                    <div className="flex items-center gap-4">
                      <div className="bg-background p-2.5 rounded-xl shadow-sm ring-1 ring-border">
                        <CheckCircle2 size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground">Prescription Refills</span>
                        <p className="text-[10px] text-muted-foreground font-medium">Alerts when refills are approved</p>
                      </div>
                    </div>
                    <Switch 
                      checked={notifs.prescriptionRefills}
                      onCheckedChange={(v) => handleNotifChange('prescriptionRefills', v)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between p-5 bg-muted/40 rounded-2xl ring-1 ring-border">
                    <div className="flex items-center gap-4">
                      <div className="bg-background p-2.5 rounded-xl shadow-sm ring-1 ring-border">
                        <Bell size={18} className="text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground">Newsletter & Health Tips</span>
                        <p className="text-[10px] text-muted-foreground font-medium">Weekly wellness updates</p>
                      </div>
                    </div>
                    <Switch 
                      checked={notifs.newsletter}
                      onCheckedChange={(v) => handleNotifChange('newsletter', v)}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPEARANCE TAB */}
        <TabsContent value="appearance" className="animate-in fade-in duration-500">
          <Card className="border border-border bg-card shadow-sm overflow-hidden max-w-3xl">
            <CardHeader className="p-6 border-b border-border bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                  <Palette size={20} />
                </div>
                <CardTitle className="text-xl font-bold text-card-foreground">Theme Preferences</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Interface Theme */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Interface Theme</h4>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    { label: 'Light Mode', value: 'light' as ThemeMode, icon: <Sun className="w-9 h-9 text-amber-500" />, previewBg: 'bg-[#f8fafc]', previewBorder: 'border border-slate-200' },
                    { label: 'Dark Mode',  value: 'dark'  as ThemeMode, icon: <Moon className="w-9 h-9 text-slate-300" />, previewBg: 'bg-slate-900',  previewBorder: 'border border-slate-700' },
                    { label: 'System',     value: 'system' as ThemeMode, icon: <Laptop className="w-9 h-9 text-slate-500" />, previewBg: 'bg-gradient-to-br from-[#f8fafc] to-slate-700', previewBorder: 'border border-slate-300' },
                  ] as const).map((item) => {
                    const isActive = themeMode === item.value;
                    return (
                      <button
                        key={item.value}
                        onClick={() => {
                          setThemeMode(item.value);
                          toast.success(`${item.label} applied`);
                        }}
                        className="flex flex-col gap-3 group focus:outline-none"
                      >
                        <div
                          className={[
                            'aspect-[4/3] w-full rounded-2xl flex items-center justify-center transition-all duration-200',
                            item.previewBg,
                            item.previewBorder,
                            'group-hover:scale-[1.03] active:scale-95',
                            isActive
                              ? 'ring-2 ring-primary shadow-lg shadow-primary/20'
                              : 'ring-1 ring-border opacity-60 hover:opacity-90',
                          ].join(' ')}
                        >
                          {item.icon}
                        </div>
                        <span className={`text-xs font-bold text-center transition-colors ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {item.label}
                          {isActive && (
                            <span className="ml-1.5 inline-flex items-center justify-center w-3.5 h-3.5 bg-primary rounded-full">
                              <svg className="w-2 h-2 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                              </svg>
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accent Color */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Accent Color</h4>
                <div className="flex flex-wrap gap-3">
                  {([
                    { value: 'sky'     as AccentColor, hex: '#0ea5e9', label: 'Sky Blue' },
                    { value: 'indigo'  as AccentColor, hex: '#6366f1', label: 'Indigo'   },
                    { value: 'emerald' as AccentColor, hex: '#10b981', label: 'Emerald'  },
                    { value: 'amber'   as AccentColor, hex: '#f59e0b', label: 'Amber'    },
                    { value: 'pink'    as AccentColor, hex: '#ec4899', label: 'Pink'     },
                  ] as const).map(({ value, hex, label }) => {
                    const isActive = themeAccent === value;
                    return (
                      <button
                        key={value}
                        title={label}
                        onClick={() => {
                          setThemeAccent(value);
                          toast.success(`${label} accent applied`);
                        }}
                        style={{ backgroundColor: hex }}
                        className={[
                          'w-12 h-12 rounded-xl shadow-md transition-all duration-200 hover:scale-110 active:scale-90 focus:outline-none',
                          isActive
                            ? 'ring-2 ring-offset-2 ring-offset-background scale-110'
                            : 'opacity-70 hover:opacity-100',
                        ].join(' ')}
                        aria-label={label}
                        aria-pressed={isActive}
                      >
                        {isActive && (
                          <svg className="w-5 h-5 mx-auto text-white drop-shadow" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground font-medium">Accent color updates instantly across the entire portal.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
