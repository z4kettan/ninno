import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NnIcon } from '../icon/icon';

export type PhotoTileState = 'empty' | 'busy' | 'done' | 'error';

let nextId = 0;

/**
 * Takes one photo (or PDF). Empty, it is a large dashed tile that opens the camera;
 * afterwards it shows the picture itself, a status line and "Retake".
 */
@Component({
  selector: 'nn-photo-tile',
  imports: [NnIcon],
  template: `
    <input
      #picker
      [id]="id"
      type="file"
      class="sr-only"
      [accept]="accept()"
      [attr.capture]="capture()"
      [attr.aria-describedby]="id + '-status'"
      (change)="onPick(picker)"
    />
    @if (state() === 'empty') {
      <label
        [for]="id"
        class="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-control bg-surface px-4 py-6 text-center hover:bg-raised"
        [class.border-negative]="!!error()"
      >
        <nn-icon name="camera" [size]="32" class="mb-1 text-accent" />
        <span class="font-semibold">{{ label() }}</span>
        @if (hint()) {
          <span class="text-sm text-muted">{{ hint() }}</span>
        }
      </label>
    } @else {
      <div class="overflow-hidden rounded-card border border-border bg-surface">
        @if (previewUrl()) {
          <img
            [src]="previewUrl()"
            [alt]="label()"
            class="block max-h-72 w-full bg-raised object-contain"
          />
        } @else {
          <p class="px-4 pt-4 font-medium">{{ fileName() || label() }}</p>
        }
        <div class="flex items-center justify-between gap-3 px-4 py-3">
          <p
            [id]="id + '-status'"
            class="text-sm num"
            [class.text-negative]="state() === 'error'"
            [class.text-muted]="state() !== 'error'"
            aria-live="polite"
          >
            {{ status() }}
          </p>
          <label
            [for]="id"
            class="inline-flex min-h-11 cursor-pointer items-center rounded-control px-2 font-semibold text-accent-ink hover:bg-accent-soft"
            [class.pointer-events-none]="state() === 'busy'"
            [attr.aria-disabled]="state() === 'busy' || null"
          >
            {{ state() === 'error' ? retryLabel() : retakeLabel() }}
          </label>
        </div>
      </div>
    }
    @if (state() === 'empty' && error()) {
      <p [id]="id + '-status'" class="mt-2 text-sm text-negative">{{ error() }}</p>
    }
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnPhotoTile {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly accept = input('image/*');
  /** `user` for the front camera, `environment` for the back one, null to offer files too. */
  readonly capture = input<'user' | 'environment' | null>(null);
  readonly state = input<PhotoTileState>('empty');
  readonly status = input('');
  readonly previewUrl = input<string | null>(null);
  readonly fileName = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly retakeLabel = input('Retake');
  readonly retryLabel = input('Try again');

  readonly picked = output<File>();

  protected readonly id = `nn-photo-${nextId++}`;

  protected onPick(picker: HTMLInputElement): void {
    const file = picker.files?.[0];
    // Cleared so picking the same file again still fires `change`.
    picker.value = '';
    if (file) {
      this.picked.emit(file);
    }
  }
}
