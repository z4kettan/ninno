import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NnToastHost } from '@ninno/ui';
import { InstallBanner, OfflineScreen, UpdateBanner } from './core/pwa/pwa-banners';

@Component({
  selector: 'nn-root',
  imports: [RouterOutlet, NnToastHost, UpdateBanner, InstallBanner, OfflineScreen],
  template: `
    <nn-update-banner />
    <router-outlet />
    <nn-install-banner />
    <nn-toast-host />
    <nn-offline-screen />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {}
