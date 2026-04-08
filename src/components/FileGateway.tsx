/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO 1 — File Gateway */
'use client';

import React, { useCallback, useState } from 'react';

/** Ключ клиентского DataVault для загруженного исходного документа. */
export const IPA_SOURCE_DOC_KEY = '{{IPA_SOURCE_DOC}}' as const;

export interface FileGatewayProps {
  isDark?: boolean;
  /** Семафор LLM — блокировать загрузку при активном стриме. */
  disabled?: boolean;
  /** Текст для строки статуса под зоной drop. */
  statusLine?: string | null;
  onFileTextLoaded: (text: string, fileName: string) => void;
}

export function FileGateway({
  isDark = true,
  disabled = false,
  statusLine = null,
  onFileTextLoaded,
}: FileGatewayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = isDark
    ? { bg: '#111', border: '#333', text: '#e5e7eb', muted: '#6b7280' }
    : { bg: '#e5e7eb', border: '#d1d5db', text: '#1A1A1B', muted: '#6b7280' };

  const readTxtFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith('.txt')) {
        setError('Only .txt files are supported.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        onFileTextLoaded(text, file.name);
      };
      reader.onerror = () => setError('Failed to read file.');
      reader.readAsText(file, 'UTF-8');
    },
    [onFileTextLoaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) readTxtFile(f);
    },
    [disabled, readTxtFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (f) readTxtFile(f);
    },
    [readTxtFile]
  );

  return (
    <div
      className="flex-shrink-0 flex flex-col gap-1 px-3 py-2 font-mono text-[10px]"
      style={{ borderBottom: `1px solid ${t.border}`, background: t.bg }}
    >
      <div className="uppercase tracking-widest" style={{ color: t.muted }}>
        File Gateway
      </div>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            document.getElementById('file-gateway-input')?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className="relative rounded border border-dashed px-3 py-4 text-center transition-colors"
        style={{
          borderColor: isDragging ? '#60a5fa' : t.border,
          background: isDragging ? (isDark ? 'rgba(96,165,250,0.08)' : 'rgba(96,165,250,0.12)') : t.bg,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !disabled && document.getElementById('file-gateway-input')?.click()}
      >
        <input
          id="file-gateway-input"
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          disabled={disabled}
          onChange={onInputChange}
        />
        <span style={{ color: t.text }}>
          {disabled ? 'LLM OCCUPIED — uploads blocked' : 'Drop .txt here or click to select'}
        </span>
      </div>
      {statusLine ? (
        <div style={{ color: '#22c55e' }} aria-live="polite">
          {statusLine}
        </div>
      ) : null}
      {error ? (
        <div style={{ color: '#f87171' }} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
