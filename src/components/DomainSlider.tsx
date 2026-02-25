/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

import React from 'react';
import { AltroDomain } from '@/config/altro.config';

const SLIDER_HEIGHT_PX = 120;

interface DomainSliderProps {
  domain: AltroDomain;
  onChange: (name: string, weight: number) => void;
  snapshotWeight?: number;
  markerTitle?: string;
  /** Показывать числовое значение (если false — значение рендерится снаружи сверху) */
  showValue?: boolean;
  /** Показывать подпись домена (если false — подпись рендерится снаружи снизу) */
  showLabel?: boolean;
  /** Отключить слайдер (для режима Mirror) */
  disabled?: boolean;
  /** Высота слайдера в px (по умолчанию 120) — для компактного режима */
  height?: number;
}

export const DomainSlider: React.FC<DomainSliderProps> = ({
  domain,
  onChange,
  snapshotWeight,
  markerTitle = 'Нейтраль (0)',
  showValue = true,
  showLabel = true,
  disabled = false,
  height = SLIDER_HEIGHT_PX,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWeight = parseFloat(e.target.value);
    onChange(domain.name, newWeight);
  };

  const weight = domain.weight ?? 0;
  const fillPercent = ((weight + 1) / 2) * 100;
  const markerPosition =
    snapshotWeight !== undefined
      ? `${((1 - (snapshotWeight + 1) / 2) * 100)}%`
      : undefined;

  return (
    <div className="flex flex-col items-center gap-0.5 py-0.5 shrink-0 w-full">
      <div
        className="relative flex flex-col items-center flex-shrink-0"
        style={{ height }}
      >
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2.5 h-px bg-gray-400 dark:bg-gray-500 pointer-events-none z-[1]"
          style={{ top: '50%' }}
          title="Центр (0)"
        />
        {snapshotWeight !== undefined && (
          <div
            className="absolute left-1/2 -translate-x-1/2 w-2 h-px bg-amber-500 pointer-events-none z-10"
            style={{ top: markerPosition }}
            title={markerTitle}
          />
        )}
        <input
          type="range"
          min={-1}
          max={1}
          step={0.01}
          value={domain.weight ?? 0}
          onChange={handleChange}
          disabled={disabled}
          className="vertical-slider"
          style={
            {
              writingMode: 'vertical-lr',
              transform: 'rotate(180deg)',
              width: '4px',
              height: `${height}px`,
              ['--value' as string]: `${fillPercent}%`,
              appearance: 'slider-vertical' as React.CSSProperties['appearance'],
              WebkitAppearance: 'slider-vertical' as any,
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }
          }
        />
      </div>
        {showValue && (
        <div className="text-[10px] font-medium text-gray-600 dark:text-gray-400 tabular-nums leading-none h-4 flex items-center justify-center">
          {weight >= 0 ? '+' : ''}{weight.toFixed(2)}
        </div>
      )}
      {showLabel && (
        <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 text-center max-w-[56px] leading-tight block min-h-[24px]">
          {domain.name.replace(/_/g, ' ')}
        </label>
      )}
    </div>
  );
};
