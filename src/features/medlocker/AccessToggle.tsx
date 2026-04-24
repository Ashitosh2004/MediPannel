import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { toast } from 'react-hot-toast';
import { UserCheck, UserX, Loader2 } from 'lucide-react';
import type { MedReport, LinkedDoctor } from './types';

interface Props {
  report: MedReport;
  doctors: LinkedDoctor[];
}

/**
 * AccessToggle
 * Per-report, per-doctor access control.
 * Updates accessControl[doctorId] in Firestore in real-time.
 * Only the file owner (patient) can toggle — enforced by Firestore rules.
 */
export function AccessToggle({ report, doctors }: Props) {
  const [pending, setPending] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, boolean>>(
    report.accessControl ?? {}
  );

  async function toggle(doctorId: string) {
    const newVal = !local[doctorId];
    setPending(doctorId);
    try {
      await updateDoc(doc(db, 'medlocker', report.id), {
        [`accessControl.${doctorId}`]: newVal,
      });
      setLocal(prev => ({ ...prev, [doctorId]: newVal }));
      toast.success(newVal ? 'Access granted' : 'Access revoked');
    } catch {
      toast.error('Failed to update access');
    } finally {
      setPending(null);
    }
  }

  if (doctors.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No doctors linked from your appointments.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {doctors.map(doctor => {
        const granted = local[doctor.id] === true;
        const loading = pending === doctor.id;
        return (
          <div
            key={doctor.id}
            className="flex items-center justify-between py-2 px-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
                {doctor.name[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">Dr. {doctor.name}</p>
                {doctor.specialty && (
                  <p className="text-[10px] text-muted-foreground">{doctor.specialty}</p>
                )}
              </div>
            </div>

            {/* Toggle pill */}
            <button
              onClick={() => toggle(doctor.id)}
              disabled={loading}
              title={granted ? 'Revoke access' : 'Grant access'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 ${
                loading
                  ? 'opacity-60 cursor-not-allowed border-border text-muted-foreground'
                  : granted
                  ? 'bg-green-500/10 text-green-600 border-green-500/25 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                  : 'bg-muted text-muted-foreground border-border hover:bg-green-50 hover:text-green-600 hover:border-green-200'
              }`}
            >
              {loading ? (
                <Loader2 size={11} className="animate-spin" />
              ) : granted ? (
                <UserCheck size={11} />
              ) : (
                <UserX size={11} />
              )}
              {loading ? '…' : granted ? 'Allowed' : 'Denied'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
