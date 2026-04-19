/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO — PCGN-style Cyrillic → Latin (neutral EN mirror) */

const CYR_TO_LAT: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
  ї: 'yi',
  є: 'ye',
  ґ: 'g',
};

/** PCGN/BGN-подобная транслитерация кириллицы для neutral EN mirror. */
export function transliterateCyrillicToLatinPcgn(input: string): string {
  const s = input.normalize('NFC').replace(/«/g, '"').replace(/»/g, '"');
  let out = '';
  for (const ch of s) {
    const low = ch.toLowerCase();
    const lat = CYR_TO_LAT[low];
    if (lat !== undefined) {
      const upper = ch !== low && lat.length > 0;
      out += upper ? lat.charAt(0).toUpperCase() + lat.slice(1) : lat;
    } else {
      out += ch;
    }
  }
  return out.replace(/\s+/g, ' ').trim();
}
