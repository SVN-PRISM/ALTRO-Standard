/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ArchiveRecord } from '@/lib/db';

export interface ArchivePanelProps {
  isDark: boolean;
  /** Скопировать в исходник — только source */
  onCopyToSource: (source: string) => void;
  /** Apply Result — source + result в workspace (без Radar) */
  onApplyResult: (source: string, result: string) => void;
  onClose: () => void;
}

export function ArchivePanel({ isDark, onCopyToSource, onApplyResult, onClose }: ArchivePanelProps) {
  const [selectedRecord, setSelectedRecord] = useState<ArchiveRecord | null>(null);
  const records = useLiveQuery(() => db.archive.orderBy('timestamp').reverse().limit(200).toArray(), []);

  const bgColor = isDark ? '#111' : '#f9fafb';
  const borderColor = isDark ? '#333' : '#e5e7eb';
  const textColor = isDark ? '#e5e7eb' : '#111';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';

  const handleCopyToSource = () => {
    if (selectedRecord) {
      onCopyToSource(selectedRecord.source);
      onClose();
    }
  };

  const handleApplyResult = () => {
    if (selectedRecord) {
      onApplyResult(selectedRecord.source, selectedRecord.result);
      onClose();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {!records || records.length === 0 ? (
        <div className="text-xs text-center py-8" style={{ color: mutedColor }}>
          История текстов пока пуста. Начните транскреацию в Nexus.
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {records.map((r) => (
              <li
                key={r.id}
                className="py-2 px-2 rounded border cursor-pointer transition-all"
                style={{
                  borderColor: selectedRecord?.id === r.id ? '#3b82f6' : borderColor,
                  background: selectedRecord?.id === r.id ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)') : bgColor,
                  color: textColor,
                }}
                onClick={() => setSelectedRecord(r)}
              >
                <span className="text-[10px] block truncate">
                  {(r.result || r.source || '').slice(0, 40)}
                  {(r.result || r.source || '').length > 40 ? '…' : ''}
                </span>
                <span className="text-[8px]" style={{ color: mutedColor }}>
                  {new Date(r.timestamp).toLocaleString('ru-RU')}
                </span>
              </li>
            ))}
          </ul>

          {selectedRecord && (
            <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor }}>
              <div className="text-[9px] uppercase tracking-wider" style={{ color: mutedColor }}>
                Просмотр
              </div>
              <div
                className="p-2 rounded border text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap"
                style={{ borderColor, background: isDark ? '#0d0d0d' : '#fff', color: textColor }}
              >
                {selectedRecord.result || selectedRecord.source || '—'}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyToSource}
                  className="text-[10px] px-3 py-2 rounded border font-semibold uppercase tracking-wider flex-1 transition-colors"
                  style={{
                    borderColor: '#3b82f6',
                    background: 'rgba(59,130,246,0.15)',
                    color: '#3b82f6',
                  }}
                >
                  Скопировать в исходник
                </button>
                <button
                  type="button"
                  onClick={handleApplyResult}
                  className="text-[10px] px-3 py-2 rounded border font-semibold uppercase tracking-wider flex-1 transition-colors"
                  style={{
                    borderColor: isDark ? '#333' : '#e5e7eb',
                    background: isDark ? '#111' : '#fff',
                    color: textColor,
                  }}
                >
                  Apply Result
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
