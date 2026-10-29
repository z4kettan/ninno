import { ChangeDetectionStrategy, Component } from '@angular/core';

/** White surface with a 1px edge and no shadow (tone step + hairline, never both with a shadow). */
@Component({
  selector: 'nn-card',
  template: `<ng-content />`,
  host: { class: 'block rounded-card border border-border bg-surface p-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnCard {}
