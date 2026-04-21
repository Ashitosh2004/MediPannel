import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Save, Clock, Loader2, CalendarDays, ToggleLeft, ToggleRight } from 'lucide-react';
import { useDoctorAuth } from '../contexts/DoctorAuthContext';
import { db } from '../../lib/firebase';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00',
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AvailabilityState = {
  [day: string]: { enabled: boolean; times: string[] };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildDefaultState(): AvailabilityState {
  return DAYS.reduce<AvailabilityState>((acc, day) => {
    acc[day] = { enabled: false, times: [] };
    return acc;
  }, {});
}

function getDayAbbr(day: string): string {
  return day.slice(0, 3);
}

function isWeekend(day: string): boolean {
  return day === 'Saturday' || day === 'Sunday';
}

// ─────────────────────────────────────────────────────────────────────────────
// Day Card
// ─────────────────────────────────────────────────────────────────────────────

interface DayCardProps {
  day: string;
  enabled: boolean;
  times: string[];
  onToggleDay: (day: string) => void;
  onToggleTime: (day: string, time: string) => void;
  onSelectAll: (day: string) => void;
  onClearAll: (day: string) => void;
}

function DayCard({ day, enabled, times, onToggleDay, onToggleTime, onSelectAll, onClearAll }: DayCardProps) {
  const selectedCount = times.length;

  return (
    <div
      className={[
        'bg-white rounded-2xl border shadow-sm transition-all duration-200',
        enabled ? 'border-emerald-200' : 'border-slate-200',
      ].join(' ')}
    >
      {/* Day Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={[
              'w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-colors',
              enabled
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-400',
            ].join(' ')}
          >
            {getDayAbbr(day)}
          </div>
          <div>
            <p className={['text-sm font-bold transition-colors', enabled ? 'text-slate-800' : 'text-slate-400'].join(' ')}>
              {day}
            </p>
            {enabled && (
              <p className="text-xs text-emerald-600 font-semibold">
                {selectedCount} slot{selectedCount !== 1 ? 's' : ''} selected
              </p>
            )}
            {!enabled && (
              <p className="text-xs text-slate-400">Unavailable</p>
            )}
          </div>
        </div>

        <button
          onClick={() => onToggleDay(day)}
          className="flex items-center gap-1.5 text-sm transition-colors"
          title={enabled ? 'Disable this day' : 'Enable this day'}
        >
          {enabled ? (
            <ToggleRight size={28} className="text-emerald-500" />
          ) : (
            <ToggleLeft size={28} className="text-slate-300" />
          )}
        </button>
      </div>

      {/* Time Slots */}
      {enabled && (
        <div className="p-4">
          {/* Quick actions */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => onSelectAll(day)}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              Select all
            </button>
            <span className="text-slate-200">|</span>
            <button
              onClick={() => onClearAll(day)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Clear all
            </button>
          </div>

          {/* Slot grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-1.5">
            {TIME_SLOTS.map((time) => {
              const selected = times.includes(time);
              return (
                <button
                  key={time}
                  onClick={() => onToggleTime(day, time)}
                  className={[
                    'px-2 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border',
                    selected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200',
                  ].join(' ')}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Disabled state hint */}
      {!enabled && (
        <div className="px-4 py-3 text-xs text-slate-300 flex items-center gap-1.5">
          <Clock size={12} />
          Toggle to set availability
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Bar
// ─────────────────────────────────────────────────────────────────────────────

interface SummaryBarProps {
  availability: AvailabilityState;
}

function SummaryBar({ availability }: SummaryBarProps) {
  const activeDays = DAYS.filter((d) => availability[d]?.enabled);
  const totalSlots = activeDays.reduce((sum, d) => sum + (availability[d]?.times.length ?? 0), 0);

  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-emerald-600" />
        <span className="text-sm font-bold text-emerald-800">
          {activeDays.length} active day{activeDays.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="w-px h-4 bg-emerald-200 hidden sm:block" />
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-emerald-600" />
        <span className="text-sm font-bold text-emerald-800">
          {totalSlots} total slot{totalSlots !== 1 ? 's' : ''}
        </span>
      </div>
      {activeDays.length > 0 && (
        <>
          <div className="w-px h-4 bg-emerald-200 hidden sm:block" />
          <div className="flex flex-wrap gap-1.5">
            {activeDays.map((day) => (
              <span
                key={day}
                className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              >
                {getDayAbbr(day)}
                <span className="text-emerald-500">·{availability[day].times.length}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DoctorAvailability — Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function DoctorAvailability() {
  const { doctorUser } = useDoctorAuth();
  const uid = doctorUser?.uid ?? '';

  const [availability, setAvailability] = useState<AvailabilityState>(buildDefaultState());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Fetch existing availability ───────────────────────────────
  useEffect(() => {
    async function fetchAvailability() {
      if (!uid) return;
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'availability', uid));
        if (snap.exists()) {
          const data = snap.data();
          const slots: { day: string; times: string[] }[] = data.slots ?? [];
          const state = buildDefaultState();
          slots.forEach(({ day, times }) => {
            if (state[day] !== undefined) {
              state[day] = { enabled: times.length > 0, times };
            }
          });
          setAvailability(state);
        }
      } catch {
        toast.error('Failed to load availability');
      } finally {
        setLoading(false);
      }
    }
    fetchAvailability();
  }, [uid]);

  // ── Toggle day enabled/disabled ───────────────────────────────
  function handleToggleDay(day: string) {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        times: !prev[day].enabled ? prev[day].times : [],
      },
    }));
  }

  // ── Toggle individual time slot ───────────────────────────────
  function handleToggleTime(day: string, time: string) {
    setAvailability((prev) => {
      const current = prev[day].times;
      const updated = current.includes(time)
        ? current.filter((t) => t !== time)
        : [...current, time].sort();
      return { ...prev, [day]: { ...prev[day], times: updated } };
    });
  }

  // ── Select all slots for a day ─────────────────────────────────
  function handleSelectAll(day: string) {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], times: [...TIME_SLOTS] },
    }));
  }

  // ── Clear all slots for a day ──────────────────────────────────
  function handleClearAll(day: string) {
    setAvailability((prev) => ({
      ...prev,
      [day]: { ...prev[day], times: [] },
    }));
  }

  // ── Save ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!uid) return;
    setSaving(true);
    try {
      const slotsArray = DAYS.filter((d) => availability[d].enabled).map((day) => ({
        day,
        times: availability[day].times,
      }));

      await setDoc(doc(db, 'availability', uid), {
        doctorId: uid,
        updatedAt: serverTimestamp(),
        slots: slotsArray,
      });

      toast.success('Availability saved!');
    } catch {
      toast.error('Failed to save availability. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-44 bg-slate-100 rounded animate-pulse" />
            <div className="h-4 w-60 bg-slate-100 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-36 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <div className="h-16 bg-emerald-50 rounded-2xl animate-pulse" />
        <div className="grid gap-4 lg:grid-cols-2">
          {DAYS.map((d) => (
            <div key={d} className="bg-white rounded-2xl border border-slate-200 p-4 h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Availability</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Set the days and time slots when patients can book appointments with you.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><Loader2 size={15} className="animate-spin" />Saving...</>
          ) : (
            <><Save size={15} />Save Availability</>
          )}
        </button>
      </div>

      {/* Summary */}
      <SummaryBar availability={availability} />

      {/* Weekdays */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Weekdays</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {DAYS.filter((d) => !isWeekend(d)).map((day) => (
            <DayCard
              key={day}
              day={day}
              enabled={availability[day].enabled}
              times={availability[day].times}
              onToggleDay={handleToggleDay}
              onToggleTime={handleToggleTime}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />
          ))}
        </div>
      </div>

      {/* Weekend */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Weekend</p>
        <div className="grid gap-4 lg:grid-cols-2">
          {DAYS.filter(isWeekend).map((day) => (
            <DayCard
              key={day}
              day={day}
              enabled={availability[day].enabled}
              times={availability[day].times}
              onToggleDay={handleToggleDay}
              onToggleTime={handleToggleTime}
              onSelectAll={handleSelectAll}
              onClearAll={handleClearAll}
            />
          ))}
        </div>
      </div>

      {/* Floating Save (mobile) */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-3 rounded-2xl text-sm transition-colors inline-flex items-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? (
            <><Loader2 size={16} className="animate-spin" />Saving...</>
          ) : (
            <><Save size={16} />Save</>
          )}
        </button>
      </div>
    </div>
  );
}
