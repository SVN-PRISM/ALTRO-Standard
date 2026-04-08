/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import React from 'react';
import { db, type VaultRecord, type ArchiveRecord } from '@/lib/db';

function formatExportDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ExportModalProps {
  isDark: boolean;
  /** Текущий текст на экране (Nexus / результат) */
  currentResult: string;
  onClose: () => void;
}

export function ExportModal({ isDark, currentResult, onClose }: ExportModalProps) {
  const borderColor = isDark ? '#333' : '#e5e7eb';
  const bgColor = isDark ? '#111' : '#fff';
  const textColor = isDark ? '#e5e7eb' : '#111';

  const handleExportVault = async () => {
    const records = await db.vault.orderBy('timestamp').reverse().toArray();
    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'ALTRO Deep Memory Vault',
      count: records.length,
      records: records.map((r: VaultRecord) => ({
        id: r.id,
        name: r.name,
        source: r.source,
        result: r.result,
        radar: r.radar,
        resonance: r.resonance,
        nexusCommand: r.nexusCommand,
        model: r.model,
        timestamp: r.timestamp,
      })),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, `ALTRO_EXPORT_VAULT_${formatExportDate()}.json`);
    onClose();
  };

  const handleExportArchive = async () => {
    const records = await db.archive.orderBy('timestamp').reverse().toArray();
    const sections = records.map((r: ArchiveRecord, i: number) => {
      const date = new Date(r.timestamp).toLocaleString('ru-RU');
      return `## ${i + 1}. ${date}\n\n### Исходник\n${r.source || '—'}\n\n### Результат\n${r.result || '—'}\n\n---`;
    });
    const content = `# ALTRO — Архив текстов\n\nЭкспорт: ${formatExportDate()}\nЗаписей: ${records.length}\n\n${sections.join('\n\n')}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `ALTRO_EXPORT_ARCHIVE_${formatExportDate()}.md`);
    onClose();
  };

  const handleExportCurrent = () => {
    const text = (currentResult || '').trim() || '(пусто)';
    const content = `# ALTRO — Текущий результат\n\nЭкспорт: ${new Date().toLocaleString('ru-RU')}\n\n---\n\n${text}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    downloadBlob(blob, `ALTRO_EXPORT_CURRENT_${formatExportDate()}.md`);
    onClose();
  };

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleExportVault}
        className="text-[10px] px-3 py-2.5 rounded border font-semibold uppercase tracking-wider w-full text-left flex items-center gap-2 transition-colors hover:opacity-90"
        style={{ borderColor: '#C8A2C8', background: 'rgba(200,162,200,0.15)', color: textColor }}
      >
        Экспорт Vault (JSON)
      </button>
      <p className="text-[9px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Выгрузка всех Золотых снапшотов со всеми весами Радара.
      </p>

      <button
        type="button"
        onClick={handleExportArchive}
        className="text-[10px] px-3 py-2.5 rounded border font-semibold uppercase tracking-wider w-full text-left flex items-center gap-2 transition-colors hover:opacity-90"
        style={{ borderColor: '#60a5fa', background: 'rgba(96,165,250,0.15)', color: textColor }}
      >
        Экспорт Архива (TXT/Markdown)
      </button>
      <p className="text-[9px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Склейка всех текстов из Архива в один Markdown-файл.
      </p>

      <button
        type="button"
        onClick={handleExportCurrent}
        className="text-[10px] px-3 py-2.5 rounded border font-semibold uppercase tracking-wider w-full text-left flex items-center gap-2 transition-colors hover:opacity-90"
        style={{ borderColor: borderColor, background: bgColor, color: textColor }}
      >
        Текущий результат (Markdown)
      </button>
      <p className="text-[9px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Сохранение того, что сейчас на экране Nexus.
      </p>
    </div>
  );
}
