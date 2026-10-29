import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API, AuthStore, SKIP_AUTH } from './auth.store';

const withToken = (req: HttpRequest<unknown>, token: string | null) =>
  token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

/**
 * Adds the access token to API calls. On a 401 it refreshes once (shared with any other
 * failing call) and retries; if the refresh fails, the user goes back to login and returns
 * to the same page afterwards.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API) || req.context.get(SKIP_AUTH)) {
    return next(req);
  }
  const store = inject(AuthStore);
  const router = inject(Router);

  return next(withToken(req, store.token())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return from(store.refresh()).pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            void router.navigate(['/login'], { queryParams: { next: router.url } });
            return throwError(() => error);
          }
          return next(withToken(req, store.token()));
        }),
      );
    }),
  );
};
