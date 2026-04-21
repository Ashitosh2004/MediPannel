import React from 'react';
import { 
  createRouter, 
  createRoute, 
  createRootRoute, 
  RouterProvider, 
  Outlet 
} from '@tanstack/react-router';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { Dashboard } from './pages/Dashboard';
import { Appointments } from './pages/Appointments';
import { Records } from './pages/Records';
import { Prescriptions } from './pages/Prescriptions';
import { Messages } from './pages/Messages';
import { Profile } from './pages/Profile';
import { Settings } from './pages/Settings';
import { Help } from './pages/Help';

// Doctor imports
import { DoctorAuthProvider } from './doctor/contexts/DoctorAuthContext';
import { DoctorProtectedRoute } from './doctor/components/DoctorProtectedRoute';
import { DoctorLayout } from './doctor/components/DoctorLayout';
import { DoctorLogin } from './doctor/pages/DoctorLogin';
import { DoctorForgotPassword } from './doctor/pages/DoctorForgotPassword';
import { DoctorPrescriptions } from './doctor/pages/DoctorPrescriptions';
import { DoctorAvailability } from './doctor/pages/DoctorAvailability';
import { DoctorDashboard } from './doctor/pages/DoctorDashboard';
import { DoctorAppointments } from './doctor/pages/DoctorAppointments';
import { DoctorPatients } from './doctor/pages/DoctorPatients';
import { DoctorPatientDetail } from './doctor/pages/DoctorPatientDetail';
import { DoctorMessages } from './doctor/pages/DoctorMessages';
import { DoctorProfile } from './doctor/pages/DoctorProfile';
import { DoctorSettings } from './doctor/pages/DoctorSettings';

// Admin imports
import { AdminAuthProvider } from './admin/contexts/AdminAuthContext';
import { AdminProtectedRoute } from './admin/components/AdminProtectedRoute';
import { AdminLogin } from './admin/pages/AdminLogin';
import { AdminDashboard } from './admin/pages/AdminDashboard';
import { DoctorManagement } from './admin/pages/DoctorManagement';
import { AdminAppointments } from './admin/pages/AdminAppointments';
import { PatientManagement } from './admin/pages/PatientManagement';
import { AvailabilityManagement } from './admin/pages/AvailabilityManagement';
import { AdminMessages } from './admin/pages/AdminMessages';
import { AdminChatBot } from './admin/pages/AdminChatBot';
import { AdminProfile } from './admin/pages/AdminProfile';
import { AdminSettings } from './admin/pages/AdminSettings';
import { AuditLogs } from './admin/pages/AuditLogs';
import { AdminForgotPassword } from './admin/pages/AdminForgotPassword';

// ── Root route ──────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <AdminAuthProvider>
        <DoctorAuthProvider>
          <Outlet />
        </DoctorAuthProvider>
      </AdminAuthProvider>
    </AuthProvider>
  ),
});

// ── Patient routes ──────────────────────────────────────────────
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <ProtectedRoute><Dashboard /></ProtectedRoute>,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  component: Signup,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPassword,
});

// Alias: /dashboard → same as /
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: () => <ProtectedRoute><Dashboard /></ProtectedRoute>,
});

const appointmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/appointments',
  component: () => <ProtectedRoute><Appointments /></ProtectedRoute>,
});

const recordsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/records',
  component: () => <ProtectedRoute><Records /></ProtectedRoute>,
});

const prescriptionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prescriptions',
  component: () => <ProtectedRoute><Prescriptions /></ProtectedRoute>,
});

const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages',
  component: () => <ProtectedRoute><Messages /></ProtectedRoute>,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => <ProtectedRoute><Profile /></ProtectedRoute>,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => <ProtectedRoute><Settings /></ProtectedRoute>,
});

const helpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/help',
  component: () => <ProtectedRoute><Help /></ProtectedRoute>,
});

// ── Doctor routes ──────────────────────────────────────────────
const doctorLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/login',
  component: DoctorLogin,
});

const doctorForgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/forgot-password',
  component: DoctorForgotPassword,
});

const doctorIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout><DoctorDashboard /></DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

const doctorAppointmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/appointments',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout><DoctorAppointments /></DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

const doctorPatientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/patients',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout><DoctorPatients /></DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

const doctorPatientDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/patients/$patientId',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout><DoctorPatientDetail /></DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

const doctorPrescriptionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/prescriptions',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout>
        <DoctorPrescriptions />
      </DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

const doctorAvailabilityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/availability',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout>
        <DoctorAvailability />
      </DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

const doctorMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/messages',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout><DoctorMessages /></DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

const doctorProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/profile',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout><DoctorProfile /></DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

const doctorSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/doctor/settings',
  component: () => (
    <DoctorProtectedRoute>
      <DoctorLayout><DoctorSettings /></DoctorLayout>
    </DoctorProtectedRoute>
  ),
});

// ── Admin routes ────────────────────────────────────────────────
const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: AdminLogin,
});

const adminForgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/forgot-password',
  component: AdminForgotPassword,
});

const adminIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: () => <AdminProtectedRoute><AdminDashboard /></AdminProtectedRoute>,
});

const adminDoctorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/doctors',
  component: () => <AdminProtectedRoute><DoctorManagement /></AdminProtectedRoute>,
});

const adminAppointmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/appointments',
  component: () => <AdminProtectedRoute><AdminAppointments /></AdminProtectedRoute>,
});

const adminPatientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/patients',
  component: () => <AdminProtectedRoute><PatientManagement /></AdminProtectedRoute>,
});

const adminAvailabilityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/availability',
  component: () => <AdminProtectedRoute><AvailabilityManagement /></AdminProtectedRoute>,
});

const adminMessagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/messages',
  component: () => <AdminProtectedRoute><AdminMessages /></AdminProtectedRoute>,
});

const adminChatBotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/chatbot',
  component: () => <AdminProtectedRoute><AdminChatBot /></AdminProtectedRoute>,
});

const adminProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/profile',
  component: () => <AdminProtectedRoute><AdminProfile /></AdminProtectedRoute>,
});

const adminSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/settings',
  component: () => <AdminProtectedRoute><AdminSettings /></AdminProtectedRoute>,
});

const auditLogsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/audit-logs',
  component: () => <AdminProtectedRoute><AuditLogs /></AdminProtectedRoute>,
});

// ── Route tree ──────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([
  // Patient
  indexRoute,
  dashboardRoute,
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  appointmentsRoute,
  recordsRoute,
  prescriptionsRoute,
  messagesRoute,
  profileRoute,
  settingsRoute,
  helpRoute,
  // Doctor
  doctorLoginRoute,
  doctorForgotPasswordRoute,
  doctorIndexRoute,
  doctorAppointmentsRoute,
  doctorPatientsRoute,
  doctorPatientDetailRoute,
  doctorPrescriptionsRoute,
  doctorAvailabilityRoute,
  doctorMessagesRoute,
  doctorProfileRoute,
  doctorSettingsRoute,
  // Admin
  adminLoginRoute,
  adminForgotPasswordRoute,
  adminIndexRoute,
  adminDoctorsRoute,
  adminAppointmentsRoute,
  adminPatientsRoute,
  adminAvailabilityRoute,
  adminMessagesRoute,
  adminChatBotRoute,
  adminProfileRoute,
  adminSettingsRoute,
  auditLogsRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
