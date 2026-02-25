/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Tools Modal */
'use client';

import { useEffect } from 'react';

export interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDark?: boolean;
}

export function ToolsModal({ isOpen, onClose, title, children, isDark }: ToolsModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="w-full max-w-md rounded-lg shadow-xl overflow-hidden"
        style={{
          background: isDark ? '#1a1a1a' : '#fafafa',
          border: `1px solid ${isDark ? '#333' : '#e5e7eb'}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: isDark ? '#333' : '#e5e7eb' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-6 h-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: isDark ? '#9ca3af' : '#6b7280' }}
          >
            ×
          </button>
        </div>
        <div className="p-4 max-h-[60vh] overflow-y-auto" style={{ color: isDark ? '#e5e7eb' : '#111' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
