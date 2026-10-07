/**
 * Pet Memorial Book — the bridge between the app's stores and the book.
 *
 * The book reads the SAME contexts every other screen reads (pets and their
 * photo, the journal — one store for memories and written entries alike — care
 * check-ins, vet records, vaccinations, the awards shelf, and the owner's own
 * name) so there is no second copy of the data and no re-entry anywhere. This
 * hook gathers them into a `MemorialSource` and hands back the document/HTML
 * builders for a given configuration.
 *
 * 100% offline: it only reads already-loaded local state. Nothing is fetched,
 * nothing is uploaded, and no AI or server is involved in a page of this book.
 */
import { useCallback, useMemo } from 'react';

import { usePets } from '../../context/PetContext';
import { useJournal } from '../../context/JournalContext';
import { useCheckIns } from '../../context/CheckInsContext';
import { useVetRecords } from '../../context/VetContext';
import { useVaccines } from '../../context/VaccinesContext';
import { useAwards } from '../../context/AwardsContext';
import { useAccount } from '../../context/AccountContext';
import { buildMemorialDocument } from './document';
import type { MemorialConfig, MemorialDocument, MemorialSource } from './document';
import { buildMemorialHtml } from './html';

/** Everything the memorial book prints, gathered from the app's own contexts. */
export function useMemorialSource(): MemorialSource {
  const { pets } = usePets();
  const { journalEntries } = useJournal();
  const { checkIns } = useCheckIns();
  const { vetRecords } = useVetRecords();
  const { vaccines } = useVaccines();
  const { awards } = useAwards();
  const { username, timeZone } = useAccount();

  return useMemo(
    () => ({
      pets,
      journal: journalEntries,
      checkIns,
      vetRecords,
      vaccines,
      awards,
      ownerName: username,
      timeZone,
    }),
    [pets, journalEntries, checkIns, vetRecords, vaccines, awards, username, timeZone],
  );
}

/** The document builders the memorial screens use. */
export interface MemorialBuilders {
  /** Build the structured book (the on-device preview renders this). */
  document: (config: MemorialConfig) => MemorialDocument;
  /** Build the print HTML for the same configuration (PDF + browser print). */
  html: (config: MemorialConfig) => string;
  /** The gathered stores themselves — the Keep screen counts material with them. */
  source: MemorialSource;
}

/** Gather the stores and expose the document/HTML builders for a config. */
export function useMemorialBuilders(): MemorialBuilders {
  const source = useMemorialSource();

  const document = useCallback(
    (config: MemorialConfig) => buildMemorialDocument(source, config),
    [source],
  );
  const html = useCallback(
    (config: MemorialConfig) => buildMemorialHtml(buildMemorialDocument(source, config)),
    [source],
  );

  return useMemo(() => ({ document, html, source }), [document, html, source]);
}
