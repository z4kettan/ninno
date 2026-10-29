import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Keeps a section's frame when it has nothing to show: one plain sentence about what will
 * appear here, and an optional action. Never sample data, never an illustration.
 */
@Component({
  selector: 'nn-empty-state',
  template: `
    <p class="font-semibold">{{ heading() }}</p>
    <p class="mt-1 text-sm text-muted">{{ message() }}</p>
    <div class="mt-3 empty:hidden"><ng-content /></div>
  `,
  host: {
    class: 'block rounded-card border border-dashed border-control bg-surface px-4 py-5',
    role: 'status',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnEmptyState {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
}
