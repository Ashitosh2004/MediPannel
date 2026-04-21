import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { writeAuditLog } from '../lib/auditLog';
import { toast } from 'react-hot-toast';
import { Settings, AlertTriangle, Shield, Bell, Database, CheckCircle2 } from 'lucide-react';

interface SystemSettings {
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  emailNotifications: boolean;
  maxAppointmentsPerDay: number;
  updatedAt?: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  maintenanceMode: false,
  allowNewRegistrations: true,
  emailNotifications: true,
  maxAppointmentsPerDay: 20,
};

export function AdminSettings() {
  const { adminData } = useAdminAuth();
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'systemSettings', 'global'))
      .then(snap => { if (snap.exists()) setSettings({ ...DEFAULT_SETTINGS, ...snap.data() }); setLoading(false); })
      .catch(err => { console.error('Settings error:', err); setLoading(false); });
  }, []);

  const saveSettings = async () => {
    if (!adminData) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'systemSettings', 'global'), { ...settings, updatedAt: new Date().toISOString(), updatedBy: adminData.uid });
      await writeAuditLog(adminData.uid, 'UPDATE_SETTINGS', 'systemSettings', JSON.stringify(settings).substring(0, 200));
      toast.success('Settings saved');
    } catch (err) { console.error(err); toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const toggle = (key: keyof SystemSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const Toggle = ({ value, onChange, danger }: { value: boolean; onChange: () => void; danger?: boolean }) => (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${value ? (danger ? 'bg-red-600' : 'bg-emerald-600') : 'bg-gray-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-white">System Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Configure global portal behavior and system preferences.</p>
      </div>

      {loading ? (
        <div className="p-16 text-center text-gray-500 text-sm">
          <div className="animate-spin h-7 w-7 border-2 border-gray-700 border-t-red-500 rounded-full mx-auto mb-3" />Loading settings...
        </div>
      ) : (
        <>
          {/* Maintenance Mode */}
          {settings.maintenanceMode && (
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400 font-semibold">Maintenance mode is active. Patients cannot access the portal.</p>
            </div>
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
              <Settings size={16} className="text-red-400" />
              <h3 className="text-sm font-bold text-white">System Configuration</h3>
            </div>
            <div className="divide-y divide-gray-800">
              {[
                { key: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Temporarily disable patient access to the portal', icon: AlertTriangle, danger: true },
                { key: 'allowNewRegistrations', label: 'Allow New Registrations', desc: 'Permit new patients to create accounts', icon: Shield },
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Send automated email alerts to patients and doctors', icon: Bell },
              ].map(item => (
                <div key={item.key} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${item.danger ? 'bg-red-500/10' : 'bg-gray-800'}`}>
                      <item.icon size={16} className={item.danger ? 'text-red-400' : 'text-gray-400'} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.desc}</div>
                    </div>
                  </div>
                  <Toggle
                    value={settings[item.key as keyof SystemSettings] as boolean}
                    onChange={() => toggle(item.key as keyof SystemSettings)}
                    danger={item.danger}
                  />
                </div>
              ))}

              {/* Max appointments */}
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gray-800"><Database size={16} className="text-gray-400" /></div>
                  <div>
                    <div className="text-sm font-semibold text-white">Max Appointments Per Day</div>
                    <div className="text-xs text-gray-500">Maximum bookings allowed per doctor per day</div>
                  </div>
                </div>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.maxAppointmentsPerDay}
                  onChange={e => setSettings(p => ({ ...p, maxAppointmentsPerDay: parseInt(e.target.value) || 1 }))}
                  className="w-20 h-9 px-3 bg-gray-800 border border-gray-700 text-white rounded-xl text-sm text-center focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {settings.updatedAt && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <CheckCircle2 size={12} className="text-emerald-500" />
              Last saved: {new Date(settings.updatedAt).toLocaleString()}
            </div>
          )}

          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold rounded-xl text-sm transition-all active:scale-95"
          >
            {saving ? <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /><span>Saving...</span></> : <><Settings size={15} /><span>Save Settings</span></>}
          </button>
        </>
      )}
    </div>
  );
}
