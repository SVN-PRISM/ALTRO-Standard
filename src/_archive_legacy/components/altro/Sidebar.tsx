import React, { useState, useRef, useEffect } from 'react';
import { Settings, Save, Library, FolderOpen, Shield, Download } from 'lucide-react';
import { SCENARIO_UI_WEIGHTS, type DomainWeights } from '@/lib/altroData';

export interface SidebarProps {
  isDark: boolean;
  selectedScenario: 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard';
  setSelectedScenario: (v: 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard') => void;
  setDomainWeights: (w: DomainWeights | ((prev: DomainWeights) => DomainWeights)) => void;
  activePreset: 'mirror' | 'transfigure' | 'slang' | null;
  setToolsModalMode: (mode: 'archive' | 'export' | 'snapshot' | null) => void;
  onSaveSnapshot?: () => void | Promise<void>;
  onOpenArchive?: () => void;
  onOpenChronos?: () => void;
  /** When true, Chronos icon turns red (403 Security Policy Violation) */
  securityBlocked?: boolean;
}

export function Sidebar({ isDark, selectedScenario, setSelectedScenario, setDomainWeights, activePreset, setToolsModalMode, onSaveSnapshot, onOpenArchive, onOpenChronos, securityBlocked }: SidebarProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (presetsRef.current && !presetsRef.current.contains(event.target as Node)) {
        setShowPresets(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const iconColor = isDark ? '#9ca3af' : '#4b5563';
  const hoverColor = isDark ? '#e5e7eb' : '#111827';
  const bgColor = 'transparent';
  const borderColor = isDark ? '#1a1a1a' : '#ccc';

  const handleScenarioSelect = (v: 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard') => {
    if (activePreset === 'mirror') return;
    setSelectedScenario(v);
    if (v !== 'without') {
      const weights = SCENARIO_UI_WEIGHTS[v === 'poetry' ? 'poetics' : v];
      setDomainWeights({ ...weights });
    }
    setShowPresets(false);
  };

  const scenarios: Array<{ id: 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard', label: string }> = [
    { id: 'without', label: 'Without' },
    { id: 'poetry', label: 'Poetry' },
    { id: 'technocrat', label: 'Technocrat' },
    { id: 'sacred', label: 'Sacred' },
    { id: 'goldStandard', label: 'GOLD STANDARD' },
  ];

  return (
    <div 
      className="w-[30px] flex-shrink-0 flex flex-col items-center py-3 gap-2 border-l relative z-[55]"
      style={{ borderColor, background: bgColor }}
    >
      {/* PRESETS */}
      <div className="relative" ref={presetsRef}>
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="p-1 rounded-lg transition-colors group relative"
          style={{ color: showPresets ? hoverColor : iconColor, opacity: activePreset === 'mirror' ? 0.5 : 1 }}
          title="PRESETS (Сценарии)"
          disabled={activePreset === 'mirror'}
        >
          <Settings size={18} className="group-hover:stroke-current" />
        </button>
        
        {showPresets && (
          <div 
            className="absolute right-full top-0 mr-2 w-40 rounded-lg shadow-xl border overflow-hidden z-50"
            style={{ background: isDark ? '#111' : '#fff', borderColor }}
          >
            <div className="flex flex-col">
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleScenarioSelect(s.id)}
                  className="text-left px-4 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors"
                  style={{
                    background: selectedScenario === s.id ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)') : 'transparent',
                    color: selectedScenario === s.id ? '#3b82f6' : (isDark ? '#e5e7eb' : '#111'),
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SNAPSHOT */}
      <button
        type="button"
        onClick={async () => {
          await onSaveSnapshot?.();
          setSaveFlash(true);
          window.setTimeout(() => setSaveFlash(false), 400);
        }}
        className="p-1 rounded-lg transition-all duration-200 group"
        style={{
          color: saveFlash ? '#22c55e' : iconColor,
          boxShadow: saveFlash ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
        }}
        title="SNAPSHOT (Сохранить в Vault)"
      >
        <Save size={18} className="group-hover:stroke-current" />
      </button>

      {/* VAULT — Deep Memory Vault (Золотая полка) */}
      <button
        type="button"
        onClick={() => onOpenArchive?.()}
        className="p-1 rounded-lg transition-colors group"
        style={{ color: iconColor }}
        title="VAULT (Deep Memory Vault)"
      >
        <Library size={18} className="group-hover:stroke-current" />
      </button>

      {/* ARCHIVE — Архив текстов (результат транскреаций) */}
      <button
        type="button"
        onClick={() => setToolsModalMode('archive')}
        className="p-1 rounded-lg transition-colors group"
        style={{ color: iconColor }}
        title="ARCHIVE (Архив текстов)"
      >
        <FolderOpen size={18} className="group-hover:stroke-current" />
      </button>

      {/* CHRONOS — red when securityBlocked (403), opens Chronos logs */}
      <button
        type="button"
        onClick={onOpenChronos}
        className="p-1 rounded-lg transition-colors group"
        style={{ color: securityBlocked ? '#ef4444' : iconColor }}
        title={securityBlocked ? 'Security Policy Violation' : 'CHRONOS (Системный архив)'}
      >
        <Shield size={18} className="group-hover:stroke-current" />
      </button>

      {/* EXPORT — вызывает окно выбора формата */}
      <button
        type="button"
        onClick={() => setToolsModalMode('export')}
        className="p-1 rounded-lg transition-colors group"
        style={{ color: iconColor }}
        title="EXPORT (Экспорт)"
      >
        <Download size={18} className="group-hover:stroke-current" />
      </button>
    </div>
  );
}
