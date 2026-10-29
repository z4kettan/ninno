import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NnEmptyState } from '@ninno/ui';

/**
 * A screen whose feature arrives in a later phase. It keeps its title and frame and says
 * plainly what will appear here; it never shows sample data.
 */
@Component({
  selector: 'nn-placeholder-page',
  imports: [NnEmptyState],
  template: `
    <h1 class="text-2xl font-bold leading-tight">{{ heading() }}</h1>
    <nn-empty-state class="mt-6" heading="Nothing here yet" i18n-heading [message]="message()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaceholderPage {
  /** From route data. */
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
}
