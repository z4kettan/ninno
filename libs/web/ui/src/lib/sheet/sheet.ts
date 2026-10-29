import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { Overlay } from '@angular/cdk/overlay';
import { Injectable, inject, type Type } from '@angular/core';

/**
 * A sheet that rises from the bottom edge, at most 480px wide. Built on CDK Dialog, which
 * traps focus, closes on Escape and the backdrop, and returns focus to whatever opened it.
 */
@Injectable({ providedIn: 'root' })
export class SheetService {
  private readonly dialog = inject(Dialog);
  private readonly overlay = inject(Overlay);

  open<R = unknown, D = unknown, C = unknown>(
    component: Type<C>,
    options: { data?: D; label: string },
  ): DialogRef<R, C> {
    return this.dialog.open<R, D, C>(component, {
      data: options.data,
      ariaLabel: options.label,
      panelClass: 'nn-sheet-panel',
      backdropClass: 'nn-sheet-backdrop',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      width: '100%',
      maxWidth: '480px',
      positionStrategy: this.overlay.position().global().bottom('0').centerHorizontally(),
    });
  }
}
