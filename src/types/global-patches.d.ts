/**
 * global-patches.d.ts
 *
 * Patches @types/react HTMLAttributes to make `placeholder`,
 * `onPointerEnterCapture`, and `onPointerLeaveCapture` optional.
 *
 * These props are marked as required in the @blinkdotnew/ui (Radix UI)
 * component prop types. With strictNullChecks enabled they surface as
 * TS2739 errors even though the components work fine without them.
 * This declaration silences those errors project-wide.
 */

import 'react';

declare module 'react' {
  interface HTMLAttributes<T> {
    placeholder?: string;
    onPointerEnterCapture?: React.PointerEventHandler<T>;
    onPointerLeaveCapture?: React.PointerEventHandler<T>;
  }
  interface DOMAttributes<T> {
    onPointerEnterCapture?: React.PointerEventHandler<T>;
    onPointerLeaveCapture?: React.PointerEventHandler<T>;
  }
}
