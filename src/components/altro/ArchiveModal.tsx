/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import React, { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, VaultRecord } from '@/lib/db';
import { X, Trash2 } from 'lucide-react';

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onSelectRecord: (record: VaultRecord) => void;
}

export function ArchiveModal({ isOpen, onClose, isDark, onSelectRecord }: ArchiveModalProps) {
  const records = useLiveQuery(() => db.vault.orderBy('timestamp').reverse().toArray(), []);

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

  const handleDelete = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (id) await db.vault.delete(id);
  };

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
        className="w-full max-w-md rounded-lg shadow-xl overflow-hidden max-h-[70vh] flex flex-col"
        style={{ background: bgColor, border: `1px solid ${borderColor}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: textColor }}>
            Deep Memory Vault
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
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {!records || records.length === 0 ? (
            <div className="text-xs text-center py-10" style={{ color: mutedColor }}>
              Золотая полка пуста. Сделайте Snapshot удачного результата.
            </div>
          ) : (
            records.map((record) => (
              <div
                key={record.id}
                className="p-3 rounded-lg border cursor-pointer hover:opacity-90 transition-all group relative"
                style={{ borderColor, background: isDark ? '#111' : '#f9fafb' }}
                onClick={() => onSelectRecord(record)}
              >
                <div className="text-[10px] font-mono mb-1 truncate" style={{ color: isDark ? '#60a5fa' : '#3b82f6' }}>
                  {record.name}
                </div>
                <div className="text-xs line-clamp-2 mb-2" style={{ color: textColor }}>
                  {record.result || record.source}
                </div>
                <div className="flex justify-between items-center text-[9px]" style={{ color: mutedColor }}>
                  <span>{new Date(record.timestamp).toLocaleString()}</span>
                  <span className="uppercase">{record.model}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, record.id)}
                  className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400"
                  title="Удалить запись"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
