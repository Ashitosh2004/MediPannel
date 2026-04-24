import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { DPDP_WARNING } from './types';

interface Props {
  title?: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * WarningModal
 * Shown before opening any restricted (sensitive) health file.
 * Displays the DPDP Act 2023 / IT Act warning message.
 */
export function WarningModal({ title = 'Sensitive Health Data', onClose, onConfirm }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Red accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-destructive/60 via-destructive to-destructive/60" />

        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={15} />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <ShieldAlert size={22} className="text-destructive" />
            </div>
            <div>
              <h2 className="font-black text-foreground text-base leading-tight">{title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Restricted Health Record</p>
            </div>
          </div>

          <div className="bg-destructive/5 border border-destructive/15 rounded-xl p-4 mb-5">
            <p className="text-sm text-foreground/80 leading-relaxed">{DPDP_WARNING}</p>
          </div>

          <div className="text-xs text-muted-foreground mb-5 flex flex-wrap gap-2">
            {['DPDP Act 2023', 'IT Act 2000', 'ABDM Guidelines'].map(label => (
              <span key={label} className="px-2 py-1 bg-muted rounded-full font-semibold">{label}</span>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-xl text-sm font-bold transition-all active:scale-95"
            >
              I Understand, Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
