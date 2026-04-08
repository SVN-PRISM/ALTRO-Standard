/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import React, { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ChronosRecord } from '@/lib/db';
import { X } from 'lucide-react';

interface ChronosModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

export function ChronosModal({ isOpen, onClose, isDark }: ChronosModalProps) {
  const records = useLiveQuery(() => db.chronos.orderBy('timestamp').reverse().limit(100).toArray(), []);

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

  const bgColor = isDark ? '#1a1a1a' : '#fafafa';
  const borderColor = isDark ? '#333' : '#e5e7eb';
  const textColor = isDark ? '#e5e7eb' : '#111';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-lg shadow-xl overflow-hidden max-h-[70vh] flex flex-col"
        style={{ background: bgColor, border: `1px solid ${borderColor}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: textColor }}>
            Chronos — Системный архив
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-6 h-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: mutedColor }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {!records || records.length === 0 ? (
            <div className="text-xs text-center py-10" style={{ color: mutedColor }}>
              Логов пока нет. Запустите Транскреацию для записи в Chronos.
            </div>
          ) : (
            records.map((r: ChronosRecord) => (
              <div
                key={r.id}
                className="p-2 rounded border text-[10px] font-mono"
                style={{ borderColor, background: isDark ? '#111' : '#f9fafb', color: textColor }}
              >
                <div className="flex justify-between items-center mb-1" style={{ color: mutedColor }}>
                  <span>{r.name}</span>
                  <span>{r.generationTimeMs ?? 0}ms · {r.tokenCount ?? 0} tok</span>
                </div>
                <div className="line-clamp-2 truncate" style={{ color: textColor }}>
                  {(r.result || r.source || '—').slice(0, 80)}{(r.result || r.source || '').length > 80 ? '…' : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
