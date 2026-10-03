import React from 'react';

interface ModalShellProps {
  onClose: () => void;
  label: string;
  children: React.ReactNode;
  /** Stacking layer, for dialogs opened from other dialogs. */
  z?: string;
  width?: string;
}

/** Dialog frame: dimmed backdrop, sheet on mobile, centered card on larger screens. */
export const ModalShell: React.FC<ModalShellProps> = ({ onClose, label, children, z = 'z-50', width = 'sm:max-w-lg' }) => (
  <div className={`fixed inset-0 ${z} flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4`} onClick={onClose}>
    <div
      className={`card relative flex w-full ${width} max-h-[92vh] flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl shadow-2xl`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      {children}
    </div>
  </div>
);
