import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore, landingPath } from './auth.store';

/** Signed-out users go to login, remembering where they were heading. */
export const signedIn: CanActivateFn = (_route, state) => {
  const store = inject(AuthStore);
  return store.status() === 'signedIn'
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
};

/** Owners, managers and staff only; everyone else goes to their own area. */
export const staffArea: CanActivateFn = () => {
  const store = inject(AuthStore);
  return store.area() === 'staff' ? true : inject(Router).parseUrl(landingPath(store.area()));
};

/** Users with a resident membership only. */
export const residentArea: CanActivateFn = () => {
  const store = inject(AuthStore);
  return store.isResident() ? true : inject(Router).parseUrl(landingPath(store.area()));
};

/** The login screen is for signed-out users; signed-in users go to their area. */
export const signedOut: CanActivateFn = () => {
  const store = inject(AuthStore);
  return store.status() === 'signedIn' ? inject(Router).parseUrl(landingPath(store.area())) : true;
};

/** "/" sends each user to their area. */
export const landing: CanActivateFn = () => {
  const store = inject(AuthStore);
  return inject(Router).parseUrl(
    store.status() === 'signedIn' ? landingPath(store.area()) : '/login',
  );
};
