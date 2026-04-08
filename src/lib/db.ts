import Dexie, { type Table } from 'dexie';

export interface VaultRecord {
  id?: number;
  name: string;
  source: string;
  result: string;
  radar: Record<string, number>;
  model: string;
  timestamp: number;
  /** OPR (0–100), для восстановления состояния */
  resonance?: number;
  /** Команда из Nexus на момент Snapshot */
  nexusCommand?: string;
}

export interface ChronosRecord {
  id?: number;
  name: string;
  source: string;
  result: string;
  radar: Record<string, number>;
  model: string;
  timestamp: number;
  generationTimeMs: number;
  tokenCount: number;
}

/** Архив текстов — только source, result, timestamp (без Radar). */
export interface ArchiveRecord {
  id?: number;
  source: string;
  result: string;
  timestamp: number;
}

export class DeepMemoryDB extends Dexie {
  vault!: Table<VaultRecord, number>;
  chronos!: Table<ChronosRecord, number>;
  archive!: Table<ArchiveRecord, number>;

  constructor() {
    super('DeepMemoryDB');
    this.version(1).stores({
      vault: '++id, name, timestamp',
      chronos: '++id, name, timestamp',
    });
    this.version(2).stores({
      vault: '++id, name, timestamp',
      chronos: '++id, name, timestamp',
      archive: '++id, timestamp',
    });
  }
}

export const db = new DeepMemoryDB();

export function generateRecordName(
  id: number,
  type: string,
  resonance: number
): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  
  const paddedId = String(id).padStart(4, '0');
  const typeStr = type.toUpperCase();
  const resStr = String(Math.round(resonance));

  return `${paddedId}_${typeStr}_${yyyy}${mm}${dd}_${hh}${min}_${resStr}`;
}

export async function addChronosRecord(record: Omit<ChronosRecord, 'id' | 'name'> & { type: string, resonance: number }) {
  const count = await db.chronos.count();
  const nextId = count + 1;
  const name = generateRecordName(nextId, record.type, record.resonance);
  
  await db.chronos.add({
    ...record,
    name,
  });

  // FIFO limit 5000
  if (count >= 5000) {
    const oldest = await db.chronos.orderBy('id').limit(count - 4999).toArray();
    const idsToDelete = oldest.map(r => r.id).filter((id): id is number => id !== undefined);
    if (idsToDelete.length > 0) {
      await db.chronos.bulkDelete(idsToDelete);
    }
  }
}

export async function addVaultRecord(record: Omit<VaultRecord, 'id' | 'name'> & { type: string; resonance: number; nexusCommand?: string }) {
  const count = await db.vault.count();
  const nextId = count + 1;
  const name = generateRecordName(nextId, record.type, record.resonance);
  const { type, ...toStore } = record;
  await db.vault.add({
    ...toStore,
    name,
    resonance: record.resonance,
    nexusCommand: record.nexusCommand ?? '',
  });
}

export async function addArchiveRecord(record: Omit<ArchiveRecord, 'id'>) {
  await db.archive.add({
    source: record.source,
    result: record.result,
    timestamp: record.timestamp,
  });
  const count = await db.archive.count();
  if (count > 500) {
    const oldest = await db.archive.orderBy('id').limit(count - 500).toArray();
    const idsToDelete = oldest.map((r) => r.id).filter((id): id is number => id !== undefined);
    if (idsToDelete.length > 0) await db.archive.bulkDelete(idsToDelete);
  }
}
