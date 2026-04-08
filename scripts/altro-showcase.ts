/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

/**
 * ALTRO Showcase — цветной BEFORE / AFTER для демонстрации маскирования (без шума Masker/Firewall в консоли).
 * Запуск: npx tsx scripts/altro-showcase.ts
 */
import { SovereignController } from '../core/SovereignController';

const T = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function quietPrepareStencil(before: string, lang = 'en'): string {
  const log = console.log;
  const err = console.error;
  const warn = console.warn;
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  try {
    const ctrl = new SovereignController();
    return ctrl.prepareStencil(before, lang, undefined);
  } finally {
    console.log = log;
    console.error = err;
    console.warn = warn;
  }
}

function section(title: string, before: string): void {
  const after = quietPrepareStencil(before);
  console.log('');
  console.log(`${T.bold}${T.cyan}━━ ${title} ━━${T.reset}`);
  console.log(`${T.yellow}${T.bold}BEFORE${T.reset} ${T.dim}(raw input)${T.reset}`);
  console.log(`${T.red}${before}${T.reset}`);
  console.log(`${T.green}${T.bold}AFTER${T.reset} ${T.dim}(Translation-First stencil → executor sees only placeholders)${T.reset}`);
  console.log(`${T.green}${after}${T.reset}`);
}

function main(): void {
  console.log(`${T.bold}${T.blue}ALTRO 1.5 — Masking Showcase (Email · Bracketed projects · Nested formulas)${T.reset}`);
  console.log(`${T.dim}MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN)${T.reset}`);

  section(
    '1) Email (PII — pii_email)',
    'Contact: security@altro.example for onboarding; CC: lead.architect@corp.example.'
  );

  section(
    '2) Bracketed projects (formula_bracket — nested / adjacent brackets)',
    'Sprint [Q1 [Core]] complete; next gate [Project_Orion-V2 [Milestone-3]].'
  );

  section(
    '3) Nested formulas (Formula-Magnet №0 — display LaTeX)',
    'Identity: $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$; inline check: $a^2 + b^2 = c^2$.'
  );

  console.log('');
  console.log(`${T.dim}Tip: run ${T.reset}${T.cyan}npm run integrity-check${T.reset}${T.dim} for the automated 12/12 compliance suite.${T.reset}`);
  console.log('');
}

main();
