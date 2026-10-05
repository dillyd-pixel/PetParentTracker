/**
 * Records helpers shared by the Records tab.
 *
 * A record's "kind" (Invoice / Lab / Imaging / Vaccine / Receipt / Document) is
 * one of the design's capture-time tags. The app's `VetRecord` entity keeps its
 * free-form `notes`, so the tag is stored as a leading `Category: <tag>` line:
 * lossless, readable on the pet's own Vet records screen, and no schema change
 * in Phase 1 (the `kind` field added in Phase C says whether a record is a
 * visit, an appointment or a filed document; the tag says what the paperwork is).
 */
import type { VetRecordInput } from '../types';

/** The design's capture-time categories. */
export const RECORD_CATEGORIES = [
  'Invoice',
  'Lab',
  'Imaging',
  'Vaccine',
  'Receipt',
  'Document',
] as const;

export type RecordCategory = (typeof RECORD_CATEGORIES)[number];

/** Notes value for a category tag. */
export function categoryNotes(category: string, extra?: string): string {
  const base = `Category: ${category}`;
  return extra?.trim() ? `${base}\n${extra.trim()}` : base;
}

/** The category stored on a record, or null when it has none. */
export function recordCategory(record: Pick<VetRecordInput, 'notes'>): string | null {
  const match = /^Category:\s*(.+)$/m.exec(record.notes ?? '');
  return match ? match[1].trim() : null;
}

/** Label shown on a record row: its category, or the plain fallback. */
export function recordKind(notes?: string): string {
  return recordCategory({ notes }) ?? 'Vet record';
}
