import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Core helper — writes a single notification document to Firestore.
 * Silently fails if Firestore rules block it so the app never crashes.
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'appointment' | 'message' | 'system'
) {
  if (!userId) return;
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Silently fail — app still works even if notification creation fails
  }
}

// ─── Domain-specific helpers ──────────────────────────────────────────────────

/** Called when a patient books an appointment → notifies the assigned doctor */
export async function notifyAppointmentBooked(doctorId: string, patientName: string) {
  await createNotification(
    doctorId,
    'New Appointment Booked',
    `${patientName} booked an appointment with you.`,
    'appointment'
  );
}

/** Called when a patient cancels an appointment → notifies the assigned doctor */
export async function notifyAppointmentCancelled(doctorId: string, patientName: string) {
  await createNotification(
    doctorId,
    'Appointment Cancelled',
    `${patientName} cancelled their appointment.`,
    'appointment'
  );
}

/** Called when a patient is notified about an appointment update */
export async function notifyPatientAppointmentUpdate(
  patientId: string,
  title: string,
  message: string
) {
  await createNotification(patientId, title, message, 'appointment');
}

/** Called when a new chat message is sent → notifies the receiver */
export async function notifyNewMessage(receiverId: string, senderName: string) {
  await createNotification(
    receiverId,
    'New Message',
    `You have a new message from ${senderName}.`,
    'message'
  );
}

/** Called by admin actions (create/update/suspend doctor) → notifies the target user */
export async function notifySystemUpdate(userId: string, title: string, message: string) {
  await createNotification(userId, title, message, 'system');
}
