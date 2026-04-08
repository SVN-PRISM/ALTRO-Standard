/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import { useState } from 'react';
import { INITIAL_DOMAIN_WEIGHTS, type DomainWeights } from '@/lib/altroData';

export function useResonance() {
  const [domainWeights, setDomainWeights] = useState<DomainWeights>(INITIAL_DOMAIN_WEIGHTS);
  const [oprPrismValue, setOprPrismValue] = useState(0);
  const [isAnalyzed, setIsAnalyzed] = useState(false);

  return {
    domainWeights,
    setDomainWeights,
    oprPrismValue,
    setOprPrismValue,
    isAnalyzed,
    setIsAnalyzed,
  };
}