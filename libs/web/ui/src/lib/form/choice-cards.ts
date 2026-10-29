import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface Choice<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

let nextId = 0;

/**
 * A short list of options as tappable cards (native radios underneath). The chosen card
 * takes the hue's palest tint; nothing else on it is coloured.
 */
@Component({
  selector: 'nn-choice-cards',
  template: `
    <fieldset [attr.aria-describedby]="error() ? name + '-error' : null">
      <legend class="mb-2 text-sm font-medium">{{ legend() }}</legend>
      <div class="grid gap-2" [class.grid-cols-2]="columns() === 2">
        @for (option of options(); track option.value) {
          <label
            class="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border px-3 py-2 transition-colors duration-[var(--fast)]"
            [class.border-accent]="value() === option.value"
            [class.bg-accent-soft]="value() === option.value"
            [class.border-control]="value() !== option.value"
            [class.bg-surface]="value() !== option.value"
          >
            <input
              type="radio"
              class="size-4 shrink-0 accent-[var(--accent)]"
              [name]="name"
              [value]="option.value"
              [checked]="value() === option.value"
              [attr.aria-invalid]="!!error()"
              (change)="value.set(option.value)"
            />
            <span class="flex flex-col">
              <span class="font-medium" [class.text-accent-ink]="value() === option.value">{{
                option.label
              }}</span>
              @if (option.hint) {
                <span class="text-sm text-muted">{{ option.hint }}</span>
              }
            </span>
          </label>
        }
      </div>
      @if (error()) {
        <p [id]="name + '-error'" class="mt-2 text-sm text-negative">{{ error() }}</p>
      }
    </fieldset>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NnChoiceCards {
  readonly legend = input.required<string>();
  readonly options = input.required<readonly Choice[]>();
  readonly columns = input<1 | 2>(1);
  readonly error = input<string | null>(null);
  readonly value = model<string | null>(null);

  protected readonly name = `nn-choice-${nextId++}`;
}
