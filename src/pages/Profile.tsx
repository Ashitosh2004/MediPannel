import React, { useState, useRef } from 'react';
import { 
  Button, 
  Input, 
  Avatar, 
  AvatarImage, 
  AvatarFallback,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Field,
  FieldLabel,
  FieldError,
  Banner,
  Badge
} from '@blinkdotnew/ui';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Camera, 
  Save, 
  Stethoscope,
  Heart,
  Droplet,
  Edit2,
  Check,
  ShieldCheck,
  Smartphone,
  Globe
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { differenceInYears, format } from 'date-fns';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  address: z.string().optional(),
  bloodGroup: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

export function Profile() {
  const { user, userData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: userData?.name || '',
      phone: userData?.phone || '',
      address: userData?.address || '',
      bloodGroup: userData?.bloodGroup || '',
      dateOfBirth: userData?.dateOfBirth || '',
    },
  });

  const getAge = () => {
    if (!userData?.dateOfBirth) return 'N/A';
    try {
      return differenceInYears(new Date(), new Date(userData.dateOfBirth)) + ' Yrs';
    } catch {
      return 'N/A';
    }
  };

  const onSubmit = async (data: ProfileForm) => {
    if (!user) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: data.name,
        phone: data.phone || '',
        address: data.address || '',
        bloodGroup: data.bloodGroup || '',
        dateOfBirth: data.dateOfBirth || '',
        updatedAt: new Date().toISOString(),
      });
      await refreshUserData();
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.[0]) return;
    setUploading(true);
    const file = e.target.files[0];
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      const snapshot = await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(snapshot.ref);
      await updateDoc(doc(db, 'users', user.uid), { profileImage: photoURL });
      await refreshUserData();
      toast.success('Profile picture updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="relative group animate-in zoom-in-50 duration-500">
            <Avatar className="h-24 w-24 md:h-32 md:w-32 ring-8 ring-primary/5 border-4 border-white shadow-2xl">
              <AvatarImage src={userData?.profileImage} />
              <AvatarFallback className="text-2xl font-black bg-primary text-primary-foreground">{userData?.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-1 right-1 bg-background p-2.5 rounded-2xl shadow-xl border border-border text-primary hover:bg-primary hover:text-primary-foreground hover:scale-110 active:scale-90 transition-all duration-300 ring-4 ring-background"
            >
              <Camera size={18} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImageUpload} 
              accept="image/*" 
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-[2px]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/30 border-t-white"></div>
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{userData?.name || 'User'}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className="bg-primary/10 text-primary border-transparent rounded-full px-4 py-1.5 font-bold text-[10px] tracking-widest uppercase flex items-center gap-2 hover:bg-primary/20">
                <ShieldCheck size={14} strokeWidth={3} />
                Verified Patient
              </Badge>
              <span className="text-muted-foreground/60 text-xs font-bold">•</span>
              <p className="text-muted-foreground font-semibold flex items-center gap-1.5 text-sm">
                <Mail size={14} className="text-muted-foreground/40" />
                {user?.email}
              </p>
            </div>
          </div>
        </div>
        <Button 
          disabled={loading || !isDirty} 
          onClick={handleSubmit(onSubmit)}
          className="rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-95 flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"></div>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>Save Profile</span>
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Personal Info */}
          <Card className="border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-6 border-b border-border bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                  <User size={20} />
                </div>
                <CardTitle className="text-xl font-bold text-card-foreground">Personal Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Field>
                  <FieldLabel className="text-foreground font-semibold mb-1.5">Full Name</FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <User size={16} />
                    </div>
                    <Input 
                      {...register('name')} 
                      placeholder="John Doe" 
                      className="pl-10 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                    />
                  </div>
                  {errors.name && <FieldError className="mt-1">{errors.name.message}</FieldError>}
                </Field>

                <Field>
                  <FieldLabel className="text-foreground font-semibold mb-1.5">Phone Number</FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <Phone size={16} />
                    </div>
                    <Input 
                      {...register('phone')} 
                      placeholder="+1 (555) 000-0000" 
                      className="pl-10 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel className="text-foreground font-semibold mb-1.5">Date of Birth</FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <Calendar size={16} />
                    </div>
                    <Input 
                      {...register('dateOfBirth')} 
                      type="date" 
                      className="pl-10 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel className="text-foreground font-semibold mb-1.5">Blood Group</FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <Droplet size={16} />
                    </div>
                    <Input 
                      {...register('bloodGroup')} 
                      placeholder="e.g. O+" 
                      className="pl-10 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl uppercase"
                    />
                  </div>
                </Field>

                <Field className="md:col-span-2">
                  <FieldLabel className="text-foreground font-semibold mb-1.5">Address</FieldLabel>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                      <MapPin size={16} />
                    </div>
                    <Input 
                      {...register('address')} 
                      placeholder="123 Health Ave, Medical City, MC 12345" 
                      className="pl-10 h-12 bg-background border-border focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                    />
                  </div>
                </Field>
              </form>
            </CardContent>
          </Card>

          {/* Security & Contact */}
          <Card className="border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-6 border-b border-border bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                  <ShieldCheck size={20} />
                </div>
                <CardTitle className="text-xl font-bold text-card-foreground">Security & Contact</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between p-5 bg-muted/30 rounded-2xl ring-1 ring-border hover:ring-primary/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl text-primary">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Email Address</h4>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                <Badge className="bg-green-500/10 text-green-600 border-transparent rounded-full px-3 py-1 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 hover:bg-green-500/20">
                  <Check size={12} strokeWidth={3} />
                  Verified
                </Badge>
              </div>

              <div className="flex items-center justify-between p-5 bg-muted/30 rounded-2xl ring-1 ring-border hover:ring-primary/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl text-primary">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">Mobile Phone</h4>
                    <p className="text-sm text-muted-foreground">{userData?.phone || 'Not provided — add above and save'}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="rounded-xl font-bold h-9 px-3 text-primary hover:bg-primary/10 flex items-center gap-1.5">
                  <Edit2 size={13} />
                  <span>Edit</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Cards */}
        <div className="space-y-6">
          <Card className="border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-border bg-muted/30">
              <CardTitle className="text-base font-bold flex items-center gap-3 text-card-foreground">
                <Heart className="text-primary w-5 h-5" />
                Medical Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl ring-1 ring-primary/10">
                <div className="flex items-center gap-2">
                  <Droplet size={16} className="text-primary" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Blood Type</span>
                </div>
                <span className="text-base font-black text-primary">{userData?.bloodGroup || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-indigo-500/5 rounded-xl ring-1 ring-indigo-500/10">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-500" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Age</span>
                </div>
                <span className="text-base font-black text-indigo-500">{getAge()}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-500/5 rounded-xl ring-1 ring-green-500/10">
                <div className="flex items-center gap-2">
                  <Stethoscope size={16} className="text-green-500" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Member Since</span>
                </div>
                <span className="text-sm font-black text-green-500">
                  {userData?.createdAt?.toDate
                    ? format(userData.createdAt.toDate(), 'MMM yyyy')
                    : userData?.createdAt
                    ? format(new Date(userData.createdAt), 'MMM yyyy')
                    : 'N/A'}
                </span>
              </div>
              <Banner variant="info" className="rounded-xl border-none bg-primary/5 text-primary mt-2">
                <div className="flex gap-2 p-1">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5 text-primary" />
                  <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
                    Your health data is encrypted and only accessible during active consultations.
                  </p>
                </div>
              </Banner>
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-sm overflow-hidden">
            <CardHeader className="p-5 border-b border-border bg-muted/30">
              <CardTitle className="text-base font-bold flex items-center gap-3 text-card-foreground">
                <Globe className="text-primary w-5 h-5" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">User ID</span>
                <p className="text-xs font-mono text-foreground truncate">{user?.uid}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email Status</span>
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  {user?.emailVerified ? (
                    <><Check size={14} className="text-green-500" /> Verified</>
                  ) : (
                    <><span className="w-2 h-2 bg-amber-500 rounded-full"></span> Pending Verification</>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last Sign In</span>
                <p className="text-sm font-bold text-foreground">
                  {user?.metadata?.lastSignInTime
                    ? format(new Date(user.metadata.lastSignInTime), 'MMM dd, yyyy h:mm a')
                    : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
