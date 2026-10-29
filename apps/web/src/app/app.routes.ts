import type { Route } from '@angular/router';
import { landing, residentArea, signedIn, signedOut, staffArea } from './core/auth/guards';

/** A later-phase screen: its title and one honest sentence about what will appear there. */
const placeholder = (title: string, message: string): Partial<Route> => ({
  loadComponent: () => import('./features/shared/placeholder-page').then((m) => m.PlaceholderPage),
  title: `${title} · Ninno`,
  data: { heading: title, message },
});

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', canActivate: [landing], children: [] },
  {
    path: 'login',
    canActivate: [signedOut],
    title: 'Sign in · Ninno',
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    // Public: the hostel's QR code opens this, signed in or not.
    path: 'join/:token',
    title: 'Join your hostel · Ninno',
    loadComponent: () => import('./features/join/join-page').then((m) => m.JoinPage),
  },
  {
    path: 'no-access',
    canActivate: [signedIn],
    title: 'Not linked yet · Ninno',
    loadComponent: () => import('./features/auth/no-access-page').then((m) => m.NoAccessPage),
  },
  {
    path: 'home',
    canActivate: [signedIn, residentArea],
    loadComponent: () => import('./features/resident/resident-shell').then((m) => m.ResidentShell),
    children: [
      {
        path: '',
        title: 'Home · Ninno',
        loadComponent: () =>
          import('./features/resident/resident-home').then((m) => m.ResidentHome),
      },
      {
        path: 'payments',
        ...placeholder(
          'Payments',
          'Your rent payments and receipts appear here once the hostel records them.',
        ),
      },
      {
        path: 'profile',
        title: 'Profile · Ninno',
        loadComponent: () => import('./features/shared/profile-page').then((m) => m.ProfilePage),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [signedIn, staffArea],
    loadComponent: () => import('./features/staff/staff-shell').then((m) => m.StaffShell),
    children: [
      {
        path: '',
        title: 'Overview · Ninno',
        loadComponent: () => import('./features/staff/staff-overview').then((m) => m.StaffOverview),
      },
      {
        path: 'residents',
        ...placeholder(
          'Residents',
          'Residents appear here once they join by scanning your QR code.',
        ),
      },
      {
        path: 'approvals',
        title: 'Approvals · Ninno',
        loadComponent: () =>
          import('./features/staff/approvals/approvals-page').then((m) => m.ApprovalsPage),
      },
      {
        path: 'approvals/:id',
        title: 'Application · Ninno',
        loadComponent: () =>
          import('./features/staff/approvals/approval-detail-page').then(
            (m) => m.ApprovalDetailPage,
          ),
      },
      {
        path: 'onboarding',
        title: 'Onboarding QR · Ninno',
        loadComponent: () =>
          import('./features/staff/onboarding/onboarding-qr-page').then((m) => m.OnboardingQrPage),
      },
      {
        path: 'beds',
        ...placeholder('Beds', 'Rooms and beds, with who sleeps where, appear here.'),
      },
      {
        path: 'payments',
        ...placeholder('Payments', 'Rent you mark as paid, and what is still due, appears here.'),
      },
      {
        path: 'settings',
        ...placeholder(
          'Settings',
          'Hostel details, billing day, grace days and staff appear here.',
        ),
      },
      {
        path: 'profile',
        title: 'Profile · Ninno',
        loadComponent: () => import('./features/shared/profile-page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
