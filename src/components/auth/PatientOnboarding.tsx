import React, { useState, useCallback } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  User,
  MapPin,
  Droplets,
  Calendar,
  Phone,
  Mail,
  Image as ImageIcon,
  Shield,
  CheckCircle2,
  Loader2,
  Locate,
  ChevronRight,
  Stethoscope,
  Heart,
  AlertCircle,
} from 'lucide-react';

// ── Blood group options ────────────────────────────────────────────────────────
const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];

// ── Generate unique MedPanel Patient ID ──────────────────────────────────────
function generateMedPanelUID(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous I,O,1,0
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `MED-${segment(4)}-${segment(4)}-${segment(3)}`;
}

interface FormState {
  fullName: string;
  address: string;
  bloodGroup: string;
  dateOfBirth: string;
  phone: string;
  profileImage: string;
}

interface Props {
  onComplete: () => void;
}

export function PatientOnboarding({ onComplete }: Props) {
  const { user, refreshUserData } = useAuth();

  const [medPanelUID] = useState(() => generateMedPanelUID());
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [form, setForm] = useState<FormState>({
    fullName: '',
    address: '',
    bloodGroup: '',
    dateOfBirth: '',
    phone: '',
    profileImage: '',
  });

  const [errors, setErrors] = useState<Partial<FormState>>({});

  // ── field updater ─────────────────────────────────────────────────────────
  const set = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // ── Live location fetch ───────────────────────────────────────────────────
  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // Reverse geocode with OpenStreetMap Nominatim (free, no API key)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          const addr = data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          set('address', addr);
          toast.success('Location detected!');
        } catch {
          set('address', `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          toast.success('Coordinates captured.');
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        toast.error('Location access denied. Please enter address manually.');
      },
      { timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: Partial<FormState> = {};
    if (!form.fullName.trim() || form.fullName.trim().length < 2)
      newErrors.fullName = 'Full name is required (min 2 characters)';
    if (!form.address.trim())
      newErrors.address = 'Address is required';
    if (!form.bloodGroup)
      newErrors.bloodGroup = 'Please select your blood group';
    if (!form.dateOfBirth)
      newErrors.dateOfBirth = 'Date of birth is required';
    else {
      const dob = new Date(form.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (age < 1 || age > 120) newErrors.dateOfBirth = 'Please enter a valid date of birth';
    }
    if (!form.phone.trim() || !/^\+?[\d\s\-()]{7,15}$/.test(form.phone.trim()))
      newErrors.phone = 'Enter a valid phone number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!user) return;

    setSaving(true);
    try {
      const profileImageUrl = form.profileImage.trim() ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(form.fullName)}&background=0D8ABC&color=fff&size=256`;

      await updateDoc(doc(db, 'users', user.uid), {
        name: form.fullName.trim(),
        address: form.address.trim(),
        bloodGroup: form.bloodGroup,
        dateOfBirth: form.dateOfBirth,
        phone: form.phone.trim(),
        profileImage: profileImageUrl,
        medPanelUID,
        profileComplete: true,
        updatedAt: serverTimestamp(),
      });

      await refreshUserData();
      toast.success('Profile saved! Welcome to MedPanel Pro 🎉');
      onComplete();
    } catch (err: any) {
      console.error('Onboarding save error:', err);
      toast.error('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Field error helper ────────────────────────────────────────────────────
  const ErrMsg = ({ field }: { field: keyof FormState }) =>
    errors[field] ? (
      <p className="flex items-center gap-1.5 text-red-400 text-xs mt-1.5 font-medium">
        <AlertCircle size={12} /> {errors[field]}
      </p>
    ) : null;

  const inputCls = (field: keyof FormState) =>
    `w-full bg-white/5 border ${errors[field] ? 'border-red-500/60 focus:border-red-400' : 'border-white/10 focus:border-primary/70'} rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 outline-none transition-all focus:bg-white/8 focus:ring-2 ${errors[field] ? 'focus:ring-red-500/20' : 'focus:ring-primary/20'}`;

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Top branding */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30">
            <Stethoscope size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">MedPanel Pro</h1>
            <p className="text-primary/80 text-xs font-semibold uppercase tracking-widest">Patient Portal Setup</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/40 backdrop-blur-xl">
          {/* Header strip */}
          <div className="bg-gradient-to-r from-primary/30 via-blue-500/20 to-purple-500/20 px-8 py-6 border-b border-white/10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">Complete Your Profile</h2>
                <p className="text-white/50 text-sm mt-0.5">This information is required before accessing the portal</p>
              </div>
              {/* MedPanel UID badge */}
              <div className="shrink-0 bg-black/30 border border-white/10 rounded-2xl px-4 py-2.5 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-0.5">Your Patient ID</p>
                <p className="text-sm font-black text-primary font-mono tracking-wider">{medPanelUID}</p>
                <p className="text-[9px] text-white/30 mt-0.5">Auto-generated · Read-only</p>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mt-5">
              {[
                { n: 1, label: 'Personal' },
                { n: 2, label: 'Medical' },
                { n: 3, label: 'Contact' },
              ].map((s, i) => (
                <React.Fragment key={s.n}>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${step >= s.n ? 'bg-primary text-white shadow-md shadow-primary/40' : 'bg-white/10 text-white/30'}`}>
                      {step > s.n ? <CheckCircle2 size={14} /> : s.n}
                    </div>
                    <span className={`text-xs font-semibold hidden sm:block ${step >= s.n ? 'text-white' : 'text-white/30'}`}>{s.label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-0.5 rounded transition-all ${step > s.n ? 'bg-primary' : 'bg-white/10'}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-0">
            {/* ── Step 1: Personal ─────────────────────────────────── */}
            <div className={step === 1 ? 'block space-y-5 animate-in fade-in duration-300' : 'hidden'}>
              <div className="flex items-center gap-2 mb-5">
                <User size={16} className="text-primary" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Personal Information</h3>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  value={form.fullName}
                  onChange={e => set('fullName', e.target.value)}
                  placeholder="e.g. Ashitosh Ingale"
                  className={inputCls('fullName')}
                />
                <ErrMsg field="fullName" />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
                  Date of Birth <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={e => set('dateOfBirth', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className={`${inputCls('dateOfBirth')} pl-11 [color-scheme:dark]`}
                  />
                </div>
                <ErrMsg field="dateOfBirth" />
              </div>

              {/* Profile Image URL */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
                  Profile Image URL <span className="text-white/30">(optional)</span>
                </label>
                <div className="flex gap-3 items-start">
                  <div className="relative flex-1">
                    <ImageIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                    <input
                      type="url"
                      value={form.profileImage}
                      onChange={e => set('profileImage', e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className={`${inputCls('profileImage')} pl-11`}
                    />
                  </div>
                  {form.profileImage ? (
                    <img
                      src={form.profileImage}
                      onError={e => (e.currentTarget.style.display = 'none')}
                      className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                      alt="Preview"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-white/10 flex items-center justify-center shrink-0">
                      <User size={20} className="text-primary/50" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-white/30 mt-1.5">Leave blank to use an auto-generated avatar based on your name.</p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const e: Partial<FormState> = {};
                    if (!form.fullName.trim() || form.fullName.trim().length < 2) e.fullName = 'Full name is required';
                    if (!form.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
                    setErrors(e);
                    if (!Object.keys(e).length) setStep(2);
                  }}
                  className="w-full py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Continue <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* ── Step 2: Medical ──────────────────────────────────── */}
            <div className={step === 2 ? 'block space-y-5 animate-in fade-in duration-300' : 'hidden'}>
              <div className="flex items-center gap-2 mb-5">
                <Heart size={16} className="text-red-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Medical Details</h3>
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
                  Blood Group <span className="text-red-400">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map(bg => (
                    <button
                      key={bg}
                      type="button"
                      onClick={() => set('bloodGroup', bg)}
                      className={`py-3 rounded-xl border text-sm font-black transition-all active:scale-95 ${
                        form.bloodGroup === bg
                          ? 'bg-red-500/20 border-red-500/60 text-red-400 shadow-lg shadow-red-500/10'
                          : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <Droplets size={14} className={`mx-auto mb-1 ${form.bloodGroup === bg ? 'text-red-400' : 'text-white/20'}`} />
                      {bg}
                    </button>
                  ))}
                </div>
                <ErrMsg field="bloodGroup" />
              </div>

              {/* Patient UID (read-only display) */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/20 p-2.5 rounded-xl">
                    <Shield size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/40">MedPanel Patient ID</p>
                    <p className="text-lg font-black text-primary font-mono tracking-wider mt-0.5">{medPanelUID}</p>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      This unique ID is auto-generated and saved permanently to identify you in the system.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-bold rounded-xl transition-all active:scale-[0.98]">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const e: Partial<FormState> = {};
                    if (!form.bloodGroup) e.bloodGroup = 'Please select your blood group';
                    setErrors(e);
                    if (!Object.keys(e).length) setStep(3);
                  }}
                  className="flex-[2] py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  Continue <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* ── Step 3: Contact ──────────────────────────────────── */}
            <div className={step === 3 ? 'block space-y-5 animate-in fade-in duration-300' : 'hidden'}>
              <div className="flex items-center gap-2 mb-5">
                <MapPin size={16} className="text-green-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Contact & Location</h3>
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3 pl-11 text-white/40 text-sm outline-none cursor-not-allowed font-mono"
                  />
                </div>
                <p className="text-[11px] text-white/25 mt-1.5">Linked to your account · cannot be changed here</p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className={`${inputCls('phone')} pl-11`}
                  />
                </div>
                <ErrMsg field="phone" />
              </div>

              {/* Address with Live Location */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-widest">
                    Address <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={fetchLocation}
                    disabled={locating}
                    className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-bold rounded-lg hover:bg-green-500/20 transition-all disabled:opacity-50 active:scale-95"
                  >
                    {locating ? (
                      <><Loader2 size={11} className="animate-spin" /> Locating...</>
                    ) : (
                      <><Locate size={11} /> Use Live Location</>
                    )}
                  </button>
                </div>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-3.5 text-white/30 pointer-events-none" />
                  <textarea
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                    placeholder="123 Main Street, City, State, PIN..."
                    rows={3}
                    className={`${inputCls('address')} pl-11 resize-none`}
                  />
                </div>
                <ErrMsg field="address" />
              </div>

              {/* Summary card */}
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Summary</p>
                {[
                  { icon: User,     label: 'Name',       value: form.fullName || '—' },
                  { icon: Calendar, label: 'DOB',        value: form.dateOfBirth || '—' },
                  { icon: Droplets, label: 'Blood',      value: form.bloodGroup || '—' },
                  { icon: Shield,   label: 'Patient ID', value: medPanelUID },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3">
                    <row.icon size={13} className="text-primary/60 shrink-0" />
                    <span className="text-xs text-white/30 w-16 shrink-0">{row.label}</span>
                    <span className="text-xs text-white/70 font-semibold truncate">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(2)}
                  className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-bold rounded-xl transition-all active:scale-[0.98]">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] py-3.5 bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 text-white font-black rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-primary/30 disabled:opacity-60"
                >
                  {saving ? (
                    <><Loader2 size={18} className="animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircle2 size={18} /> Complete Setup</>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-white/20 mt-6 font-medium">
          🔒 Your data is encrypted and secured by MedPanel Pro
        </p>
      </div>
    </div>
  );
}
