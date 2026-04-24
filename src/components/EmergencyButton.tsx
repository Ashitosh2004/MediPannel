import React, { useEffect, useRef, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
  Phone, MapPin, X, AlertTriangle, Loader2,
  CheckCircle2, Navigation,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
const BACKEND = 'https://catnap-employed-causal.ngrok-free.dev';
const AMBULANCE_NO = '+917676941547';

type Phase = 'idle' | 'locating' | 'ready' | 'calling' | 'dispatched' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
export function EmergencyButton() {
  const { user, userData } = useAuth();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [location, setLocation] = useState<{ lat: number; lng: number; text: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        if (phase !== 'calling' && phase !== 'dispatched') setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [phase]);

  // Auto-fetch location when popup opens
  useEffect(() => {
    if (!open || location) return;
    setPhase('locating');
    if (!navigator.geolocation) {
      setPhase('ready');
      setLocation({ lat: 0, lng: 0, text: 'Location unavailable (GPS not supported)' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        // Reverse geocode via free Nominatim API
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          );
          const data = await res.json();
          const addr = data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setLocation({ lat, lng, text: addr });
        } catch {
          setLocation({ lat, lng, text: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
        }
        setPhase('ready');
      },
      () => {
        setLocation({ lat: 0, lng: 0, text: 'Location unavailable — please share manually' });
        setPhase('ready');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [open]);

  async function triggerEmergency() {
    if (!user) { toast.error('Please log in first'); return; }
    setPhase('calling');

    const patientName = userData?.name ?? user.email ?? 'Patient';
    const locationText = location?.text ?? 'Unknown location';

    try {
      const token = await user.getIdToken();

      // Call ambulance via AI backend
      const res = await fetch(`${BACKEND}/emergency-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patient_name: patientName,
          location_text: locationText,
        }),
      });

      if (!res.ok) {
        // Still write Firestore even if call fails
        await writeFirestoreEmergency(user.uid, patientName, locationText);
        throw new Error(`Backend error: ${res.status}`);
      }

      const data = await res.json();
      console.log('[Emergency]', data);
      setPhase('dispatched');
      toast.success('🚨 Ambulance called! Help is on the way.', { duration: 8000 });
    } catch (err: any) {
      console.error('[Emergency error]', err);
      // Fallback: write to Firestore + show manual number
      try { await writeFirestoreEmergency(user.uid, patientName, locationText); } catch {}
      setErrorMsg(err.message || 'Call failed. Please dial 108 manually.');
      setPhase('error');
    }
  }

  async function writeFirestoreEmergency(uid: string, name: string, loc: string) {
    await addDoc(collection(db, 'appointments'), {
      userId: uid,
      patientName: name,
      type: 'Emergency',
      status: 'emergency',
      notes: `SOS — ${loc}`,
      isEmergency: true,
      createdAt: serverTimestamp(),
    });
  }

  if (!user) return null;

  return (
    <>
      {/* ── Floating SOS Button ── */}
      <button
        onClick={() => { setOpen(true); setPhase('idle'); }}
        className="fixed bottom-24 right-6 z-[9999] group"
        title="Emergency SOS"
        aria-label="Emergency SOS"
      >
        {/* Pulse rings */}
        <span className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping" />
        <span className="absolute inset-0 rounded-full bg-red-400 opacity-20 animate-ping [animation-delay:0.5s]" />

        {/* Button */}
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-500/40 flex items-center justify-center group-hover:scale-110 transition-transform active:scale-95 border-2 border-white/30">
          <span className="text-white font-black text-xs leading-none text-center select-none">
            SOS
          </span>
        </div>
      </button>

      {/* ── Popup Overlay ── */}
      {open && (
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center sm:justify-end p-4 sm:pr-24 sm:pb-24 bg-black/40 backdrop-blur-sm">
          <div
            ref={popupRef}
            className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <AlertTriangle size={17} className="text-white" />
                </div>
                <div>
                  <p className="font-black text-white text-sm">Emergency SOS</p>
                  <p className="text-white/70 text-[10px]">MedPanel Pro · AI Dispatch</p>
                </div>
              </div>
              {phase !== 'calling' && (
                <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="p-5 space-y-4">
              {/* Patient info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-2xl">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                  {(userData?.name ?? 'P')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{userData?.name ?? user.email}</p>
                  <p className="text-xs text-muted-foreground">Registered patient</p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-2.5 p-3 bg-blue-500/5 border border-blue-500/15 rounded-2xl">
                <Navigation size={14} className={`text-blue-500 shrink-0 mt-0.5 ${phase === 'locating' ? 'animate-pulse' : ''}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-500 mb-0.5">Live Location</p>
                  {phase === 'locating' ? (
                    <p className="text-xs text-muted-foreground animate-pulse">Detecting your location…</p>
                  ) : (
                    <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                      {location?.text ?? 'Location not available'}
                    </p>
                  )}
                </div>
              </div>

              {/* Ambulance info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <Phone size={11} />
                <span>Ambulance: <span className="font-bold text-foreground">{AMBULANCE_NO}</span></span>
              </div>

              {/* Status / Action */}
              {phase === 'error' && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
                  <p className="text-xs text-destructive font-semibold">{errorMsg}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dial <strong className="text-foreground">108</strong> or{' '}
                    <a href={`tel:${AMBULANCE_NO}`} className="text-primary underline">{AMBULANCE_NO}</a> manually.
                  </p>
                </div>
              )}

              {phase === 'dispatched' ? (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
                  <CheckCircle2 size={22} className="text-green-600 shrink-0" />
                  <div>
                    <p className="font-black text-green-700 text-sm">Ambulance Dispatched!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Help is on the way. Stay calm.</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={triggerEmergency}
                  disabled={phase === 'calling' || phase === 'locating'}
                  className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-2xl font-black text-base shadow-lg shadow-red-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                  {phase === 'calling' ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Calling Ambulance…
                    </>
                  ) : (
                    <>
                      <Phone size={18} />
                      🚨 CALL AMBULANCE NOW
                    </>
                  )}
                </button>
              )}

              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                Pressing this button immediately calls <strong>{AMBULANCE_NO}</strong>,
                books an emergency appointment, and sends your live location via AI voice.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
