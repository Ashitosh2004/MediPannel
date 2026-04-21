// Central place for Firebase email action settings.
// The `url` is where Firebase redirects the user AFTER they click the
// verification / password-reset link in their inbox.
//
// ⚠️  Keep this in sync with your deployed URL.
//     For Vite preview on port 3000 add http://localhost:3000 to
//     Firebase Console → Authentication → Settings → Authorized domains.

const APP_URL = window.location.origin; // e.g. http://localhost:3000 or https://your-app.web.app

/**
 * ActionCodeSettings for email verification links.
 * After clicking the link the user lands on /login so they can sign in.
 */
export const verificationActionSettings = {
  url: `${APP_URL}/login?verified=true`,
  handleCodeInApp: false,
};

/**
 * ActionCodeSettings for password reset links.
 * After resetting, redirect user to login.
 */
export const resetActionSettings = {
  url: `${APP_URL}/login?reset=true`,
  handleCodeInApp: false,
};

/**
 * ActionCodeSettings for doctor portal password reset.
 */
export const doctorResetActionSettings = {
  url: `${APP_URL}/doctor/login?reset=true`,
  handleCodeInApp: false,
};

/**
 * ActionCodeSettings for admin portal password reset.
 */
export const adminResetActionSettings = {
  url: `${APP_URL}/admin/login?reset=true`,
  handleCodeInApp: false,
};
