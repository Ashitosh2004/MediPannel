import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export type AuditAction =
  | 'CREATE_DOCTOR'
  | 'DELETE_DOCTOR'
  | 'SUSPEND_DOCTOR'
  | 'UPDATE_DOCTOR'
  | 'DELETE_APPOINTMENT'
  | 'UPDATE_APPOINTMENT'
  | 'FLAG_PATIENT'
  | 'DEACTIVATE_PATIENT'
  | 'UPDATE_SETTINGS'
  | 'SET_HOLIDAY'
  | 'OVERRIDE_AVAILABILITY'
  | 'BROADCAST_MESSAGE';

export async function writeAuditLog(adminId: string, action: AuditAction, target: string, details?: string) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      adminId,
      action,
      target,
      details: details || '',
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
