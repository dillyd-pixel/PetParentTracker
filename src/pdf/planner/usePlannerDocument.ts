/**
 * Printable Pet Planner — the bridge between the app's stores and the document.
 *
 * The planner reads the SAME contexts every other screen reads (pets, vaccines,
 * medications, feeding, vet records, expenses, journal, care check-ins, care
 * instructions and the owner's own name) — there is no second copy of the data
 * and no re-entry anywhere. This hook gathers them into a `PlannerSource` and
 * hands back a builder plus the preview/PDF HTML for a given configuration.
 *
 * 100% offline: it only reads already-loaded local state.
 */
import { useCallback, useMemo } from 'react';

import { usePets } from '../../context/PetContext';
import { useVaccines } from '../../context/VaccinesContext';
import { useMedications } from '../../context/MedicationsContext';
import { useFeeding } from '../../context/FeedingContext';
import { useVetRecords } from '../../context/VetContext';
import { useExpenses } from '../../context/ExpensesContext';
import { useJournal } from '../../context/JournalContext';
import { useCheckIns } from '../../context/CheckInsContext';
import { useCareInstructions } from '../../context/CareInstructionsContext';
import { useAccount } from '../../context/AccountContext';
import { buildPlannerDocument } from './document';
import type { PlannerConfig, PlannerDocument, PlannerSource } from './document';
import { buildPlannerHtml } from './html';

/** Everything the planner prints, gathered from the app's own contexts. */
export function usePlannerSource(): PlannerSource {
  const { pets } = usePets();
  const { vaccines } = useVaccines();
  const { medications } = useMedications();
  const { feedingSchedules } = useFeeding();
  const { vetRecords } = useVetRecords();
  const { expenses } = useExpenses();
  const { journalEntries } = useJournal();
  const { checkIns } = useCheckIns();
  const { careInstructions } = useCareInstructions();
  const { username, timeZone } = useAccount();

  return useMemo(
    () => ({
      pets,
      vaccines,
      medications,
      feeding: feedingSchedules,
      vetRecords,
      expenses,
      journal: journalEntries,
      checkIns,
      careInstructions,
      ownerName: username,
      timeZone,
    }),
    [
      pets,
      vaccines,
      medications,
      feedingSchedules,
      vetRecords,
      expenses,
      journalEntries,
      checkIns,
      careInstructions,
      username,
      timeZone,
    ],
  );
}

/** The document builders the planner screens use. */
export interface PlannerBuilders {
  /** Build the structured document (the on-device preview renders this). */
  document: (config: PlannerConfig) => PlannerDocument;
  /** Build the print HTML for the same configuration (PDF + browser print). */
  html: (config: PlannerConfig) => string;
}

/** Gather the stores and expose the document/HTML builders for a config. */
export function usePlannerBuilders(): PlannerBuilders {
  const source = usePlannerSource();

  const document = useCallback(
    (config: PlannerConfig) => buildPlannerDocument(source, config),
    [source],
  );
  const html = useCallback(
    (config: PlannerConfig) => buildPlannerHtml(buildPlannerDocument(source, config)),
    [source],
  );

  return useMemo(() => ({ document, html }), [document, html]);
}
