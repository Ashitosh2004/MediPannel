// ─────────────────────────────────────────────────────────────────────────────
// MedLocker — Shared types
// ─────────────────────────────────────────────────────────────────────────────

export type MedCategory =
  | 'general'
  | 'genetic'
  | 'mental_health'
  | 'sexual_health'
  | 'hiv'
  | 'pregnancy';

export const CATEGORY_META: Record<MedCategory, { label: string; color: string; emoji: string }> = {
  general:      { label: 'General',       color: 'bg-blue-100 text-blue-700',   emoji: '📋' },
  genetic:      { label: 'Genetic',       color: 'bg-purple-100 text-purple-700', emoji: '🧬' },
  mental_health:{ label: 'Mental Health', color: 'bg-teal-100 text-teal-700',   emoji: '🧠' },
  sexual_health:{ label: 'Sexual Health', color: 'bg-pink-100 text-pink-700',   emoji: '🩺' },
  hiv:          { label: 'HIV',           color: 'bg-red-100 text-red-700',     emoji: '🔴' },
  pregnancy:    { label: 'Pregnancy',     color: 'bg-green-100 text-green-700', emoji: '🤰' },
};

export interface MedReport {
  id: string;
  userId: string;
  fileUrl: string;
  fileName: string;
  fileSize?: string;
  category: MedCategory;
  isRestricted: boolean;
  createdAt: any;           // Firestore Timestamp
  isDeleted: boolean;
  accessControl: Record<string, boolean>;
  uploadedByDoctorId?: string;
  uploadedByDoctor?: string;
}

export interface LinkedDoctor {
  id: string;
  name: string;
  specialty?: string;
}

export const DPDP_WARNING =
  'This is sensitive health data. As per the Digital Personal Data Protection Act, 2023, ' +
  'IT Act, 2000, and ABDM guidelines, it will be shared only with your explicit consent for ' +
  'a specific medical purpose. You can revoke access at any time.';
