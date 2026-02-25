/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

import React from 'react';

interface LEDIndicatorProps {
  isActive: boolean;
  label: string;
  showLabel?: boolean;
  /** Значение слайдера -1..1: 0 — тусклый, ±1 — яркий (влияет на opacity/яркость точки) */
  sliderValue?: number;
}

export const LEDIndicator: React.FC<LEDIndicatorProps> = ({ isActive, label, showLabel = true, sliderValue = 0 }) => {
  const intensity = 0.35 + 0.65 * Math.min(1, Math.abs(sliderValue ?? 0));
  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0" title={label}>
      <div
        className={`w-3 h-3 rounded-full border transition-all duration-300 ${
          isActive
            ? 'bg-green-500 border-green-600'
            : 'bg-red-500 border-red-600'
        }`}
        style={{
          opacity: intensity,
          boxShadow: isActive
            ? `0 0 ${4 * intensity}px rgba(34, 197, 94, ${0.5 + 0.3 * intensity})`
            : `0 0 ${4 * intensity}px rgba(239, 68, 68, ${0.5 + 0.3 * intensity})`,
        }}
      />
      {showLabel && (
        <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400 text-center max-w-[48px] leading-tight truncate">
          {label}
        </span>
      )}
    </div>
  );
};
