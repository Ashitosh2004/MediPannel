# MedPanel Pro

> A full-stack healthcare management platform built with React, Vite, Firebase, and Tailwind CSS.

**Live Demo:** [your-project.vercel.app](https://your-project.vercel.app)

---

## 📋 Overview

MedPanel Pro is a three-portal healthcare system that connects patients, doctors, and administrators through a unified, real-time interface.

| Portal | Route | Description |
|--------|-------|-------------|
| 🩺 Patient Portal | `/` | Book appointments, view records, chat with doctors |
| 👨‍⚕️ Doctor Portal | `/doctor` | Manage appointments, view patients, receive messages |
| 🔐 Admin Panel | `/admin` | Manage doctors, patients, broadcast announcements |

---

## ✨ Features

### Patient Portal
- Secure email/password registration & login
- Mandatory profile onboarding (name, DOB, blood group, address, auto-generated UID)
- Appointment booking wizard with doctor selection
- Medical records manager (upload & view)
- Real-time messaging with assigned doctors
- Prescription viewer
- AI health chatbot
- Notification bell (appointment + message alerts)

### Doctor Portal
- Admin-provisioned credentials (password reset via email)
- Dashboard: today's appointments, upcoming schedule, patient count
- Appointment management (status updates, clinical notes)
- Patient list derived from appointment history
- Real-time messaging with patients
- Notification bell (admin broadcasts visible for 24 hours)
- AI assistant chatbot

### Admin Panel
- Full doctor management (create, suspend, reset password)
- Patient management (view, flag, deactivate)
- Appointment oversight and status filtering
- Broadcast announcements to all doctors (notifications auto-expire in 24 h)
- Audit logs for all admin actions
- Real-time dashboard with stats

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript |
| Build tool | Vite 7 |
| Styling | Tailwind CSS |
| Routing | TanStack Router |
| Backend / DB | Firebase (Firestore, Auth, Storage) |
| Deployment | Vercel |

---

## 🚀 Deploying to Vercel

### Option 1 — Vercel Dashboard (recommended)

1. Push this repo to **GitHub / GitLab / Bitbucket**.
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo.
3. Framework preset: **Vite** (auto-detected).
4. Set the following **Environment Variables** in the Vercel project settings:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

5. Click **Deploy**. SPA routing is handled automatically via `vercel.json`.

### Option 2 — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

> **Note:** The `vercel.json` in the root already configures SPA fallback rewrites and security headers — no additional setup needed.

---

## 🏗 Local Development

### Prerequisites
- Node.js ≥ 18
- A Firebase project with **Firestore**, **Authentication** (Email/Password), and **Storage** enabled

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.local.example .env.local
# Fill in your Firebase credentials

# 3. Deploy Firestore security rules
firebase deploy --only firestore:rules

# 4. Start dev server
npm run dev
```

The app runs at `http://localhost:3000`.

### Build for production

```bash
npm run build
npm run preview   # preview the production build locally
```

---

## 🔐 Firebase Setup

### Authentication
Enable **Email/Password** in Firebase Console → Authentication → Sign-in methods.

### Firestore
The security rules are in `firestore.rules`. Deploy with:
```bash
firebase deploy --only firestore:rules
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 📁 Project Structure

```
src/
├── admin/              # Admin portal
│   ├── contexts/       # AdminAuthContext
│   ├── pages/          # Dashboard, DoctorManagement, PatientManagement, etc.
│   └── lib/            # auditLog, adminAuthHelper
├── doctor/             # Doctor portal
│   ├── contexts/       # DoctorAuthContext
│   └── pages/          # DoctorDashboard, Appointments, Patients, Messages
├── pages/              # Patient portal pages
├── components/         # Shared UI components (NotificationBell, etc.)
├── contexts/           # AuthContext (patient)
├── hooks/              # useNotifications, etc.
├── lib/                # firebase.ts, notifications.ts, emailActionSettings.ts
└── routes/             # TanStack Router route tree
```

---

## 🧪 Test Accounts

> These are example credentials for a staging Firebase project. Replace with your own.

| Role | Email | Password |
|------|-------|----------|
| Patient | patient@example.com | — (register via app) |
| Doctor | doctor@example.com | Set by admin via password reset email |
| Admin | admin@example.com | — (set in Firebase Console) |

---

## 📄 License

This project is for educational and portfolio purposes.