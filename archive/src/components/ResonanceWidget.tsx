/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import { useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Draggable from 'react-draggable';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

import type { DomainWeights } from '@/lib/altroData';
import { prepareRadarSeries } from '@/lib/altro/radarChartData';

type WidgetDatum = { axis: string; value: number };

function ActivityIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 13h3l2-8 4 14 2-6h5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ResonanceWidget({
  isDark,
  domainWeights,
  oprSlider,
  effectiveOpr,
  isListening = false,
  activeFileName,
  isFileProcessing = false,
  securityBlocked = false,
}: {
  isDark: boolean;
  domainWeights: DomainWeights;
  /** UI slider 0..100 */
  oprSlider: number;
  /** Optional effective resonance [-100..100] for dips */
  effectiveOpr?: number;
  /** When true, RadarChart gets a light breathing scale animation */
  isListening?: boolean;
  activeFileName?: string;
  isFileProcessing?: boolean;
  /** When true, indicator turns red (403 Security Policy Violation) */
  securityBlocked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(true);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const nodeRef = useRef(null);

  const series = useMemo(
    () => prepareRadarSeries(oprSlider, domainWeights, effectiveOpr),
    [oprSlider, domainWeights, effectiveOpr]
  );

  const data: WidgetDatum[] = useMemo(() => {
    const rows: WidgetDatum[] = [];
    const d = series.domains ?? {};
    // 13 доменов
    rows.push({ axis: 'SEM', value: d.semantics ?? 0 });
    rows.push({ axis: 'CTX', value: d.context ?? 0 });
    rows.push({ axis: 'INT', value: d.intent ?? 0 });
    rows.push({ axis: 'IMG', value: d.imagery ?? 0 });
    rows.push({ axis: 'LAW', value: d.ethics ?? 0 });
    rows.push({ axis: 'ECO', value: d.economics ?? 0 });
    rows.push({ axis: 'POL', value: d.politics ?? 0 });
    rows.push({ axis: 'SOC', value: d.society ?? 0 });
    rows.push({ axis: 'HIS', value: d.history ?? 0 });
    rows.push({ axis: 'CUL', value: d.culture ?? 0 });
    rows.push({ axis: 'AES', value: d.aesthetics ?? 0 });
    rows.push({ axis: 'TEC', value: d.technology ?? 0 });
    rows.push({ axis: 'SPI', value: d.spirituality ?? 0 });
    // OPR отдельным лучом
    rows.push({ axis: 'OPR', value: series.opr });
    return rows;
  }, [series]);

  const neon = isDark ? '#60a5fa' : '#2563eb';
  const panelBg = isDark ? 'rgba(5, 8, 12, 0.92)' : 'rgba(255,255,255,0.92)';
  const border = isDark ? '#1f2937' : '#d1d5db';
  const text = isDark ? '#e5e7eb' : '#111827';

  const dip = series.oprDip === true;
  const blocked = securityBlocked === true;
  const fill = blocked ? 'rgba(239,68,68,0.28)' : dip ? 'rgba(249,115,22,0.28)' : 'rgba(96,165,250,0.22)';
  const stroke = blocked ? '#ef4444' : dip ? '#f97316' : neon;
  const glow = blocked ? 'rgba(239,68,68,0.55)' : dip ? 'rgba(249,115,22,0.55)' : 'rgba(96,165,250,0.55)';

  return (
    <Draggable
      disabled={open && isPinned}
      nodeRef={nodeRef}
      handle=".drag-handle"
      position={isPinned ? { x: 0, y: 0 } : position}
      onStop={(e, data) => setPosition({ x: data.x, y: data.y })}
    >
      <div
        ref={nodeRef}
        className={!open ? 'drag-handle' : ''}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 50,
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
          opacity: open ? 0.6 : 1,
          transition: isPinned ? 'transform 0.3s ease' : 'none',
        }}
      >
        {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Resonance Radar"
          title="Resonance Radar"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            border: `1px solid ${border}`,
            background: panelBg,
            color: text,
            display: 'grid',
            placeItems: 'center',
            boxShadow: `0 0 18px ${glow}`,
            cursor: 'pointer',
            transition: 'transform 180ms ease, box-shadow 180ms ease',
            ...(dip && { animation: 'altroPulse 1.2s ease-in-out infinite' }),
          }}
        >
          <ActivityIcon color={stroke} />
        </button>
      ) : (
        <div
          style={{
            width: 320,
            height: 320,
            borderRadius: 16,
            border: `1px solid ${border}`,
            background: panelBg,
            color: text,
            boxShadow: `0 0 24px ${glow}`,
            overflow: 'hidden',
          }}
        >
          <div
            className="drag-handle"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: `1px solid ${border}`,
              cursor: isPinned ? 'default' : 'move',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ActivityIcon color={stroke} />
              <span style={{ fontSize: 11, letterSpacing: 1.1, fontWeight: 700, opacity: 0.92 }}>
                RESONANCE RADAR
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setIsPinned(!isPinned)}
                title={isPinned ? "Открепить (сделать плавающим)" : "Прикрепить"}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  border: `1px solid ${border}`,
                  background: isPinned ? (isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)') : (isDark ? 'rgba(17,24,39,0.7)' : 'rgba(255,255,255,0.7)'),
                  color: isPinned ? neon : text,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  opacity: 0.85,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="17" x2="12" y2="22" />
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Resonance Radar"
                title="Close"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  border: `1px solid ${border}`,
                  background: isDark ? 'rgba(17,24,39,0.7)' : 'rgba(255,255,255,0.7)',
                  color: text,
                  cursor: 'pointer',
                  lineHeight: '26px',
                  textAlign: 'center',
                  opacity: 0.85,
                }}
              >
                ×
              </button>
            </div>
          </div>

          <motion.div
            style={{ 
              padding: 10, 
              width: '100%', 
              height: activeFileName ? 'calc(320px - 48px - 28px)' : 'calc(320px - 48px)',
              position: 'relative'
            }}
            animate={
              isFileProcessing 
                ? { scale: [1, 1.05, 1], opacity: [1, 0.8, 1] } 
                : open && isListening 
                  ? { scale: [1, 1.03, 1] } 
                  : { scale: 1 }
            }
            transition={{ 
              duration: isFileProcessing ? 1.5 : 2, 
              repeat: (open && isListening) || isFileProcessing ? Infinity : 0, 
              ease: 'easeInOut' 
            }}
          >
            {isFileProcessing && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: `linear-gradient(to bottom, transparent, ${glow}, transparent)`,
                animation: 'radarScan 2s linear infinite',
                pointerEvents: 'none',
                zIndex: 10,
                opacity: 0.5
              }} />
            )}
            <div style={{ minWidth: '300px', minHeight: '300px', width: '100%', height: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={data} cx="50%" cy="50%" outerRadius="55%">
                  <PolarGrid stroke={isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.12)'} />
                  <PolarAngleAxis
                    dataKey="axis"
                    tick={{ fill: isDark ? 'rgba(229,231,235,0.82)' : 'rgba(17,24,39,0.82)', fontSize: 10 }}
                  />
                  <PolarRadiusAxis
                    domain={[-100, 100]}
                    tickCount={5}
                    tick={{ fill: isDark ? 'rgba(229,231,235,0.55)' : 'rgba(17,24,39,0.55)', fontSize: 9 }}
                    stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(15,23,42,0.18)'}
                  />
                  <Radar
                    dataKey="value"
                    stroke={stroke}
                    fill={fill}
                    fillOpacity={1}
                    strokeWidth={1.25}
                    dot={false}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {activeFileName && (
            <div style={{
              height: 28,
              borderTop: `1px solid ${border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: neon,
              background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '0 8px'
            }}>
              📁 Документ: {activeFileName} | Статус: {isFileProcessing ? 'Локальный анализ Qwen...' : 'Анализ завершен'}
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes altroPulse {
          0% { box-shadow: 0 0 14px ${glow}; transform: translateZ(0) scale(1); }
          50% { box-shadow: 0 0 26px ${glow}; transform: translateZ(0) scale(1.03); }
          100% { box-shadow: 0 0 14px ${glow}; transform: translateZ(0) scale(1); }
        }
        @keyframes radarScan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
      </div>
    </Draggable>
  );
}

