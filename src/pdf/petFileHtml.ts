/**
 * Pet file document builder — Blueprint Premium feature 3/4 (PDF export).
 *
 * Pure function: takes one pet plus that pet's already-loaded records and
 * returns a self-contained HTML string for `Print.printToFileAsync({ html })`.
 * No network, no assets, no remote fonts — inline CSS only, fully offline.
 *
 * Brand look: cream page, warm terracotta section headings, amber accents.
 * Dates/amounts reuse the existing label helpers (medicationScheduleLabel,
 * feedingScheduleLabel, feedingDaysLabel, expenseAmountLabel) so the PDF reads
 * exactly like the app.
 */

import {
  VACCINE_DUE_SOON_DAYS,
  expenseAmountLabel,
  feedingDaysLabel,
  feedingScheduleLabel,
  medicationScheduleLabel,
  type Expense,
  type FeedingSchedule,
  type JournalEntry,
  type Medication,
  type Pet,
  type Vaccine,
  type VetRecord,
} from '../types';

/** Everything the document needs for one pet — gathered by the caller. */
export interface PetFileData {
  pet: Pet;
  vaccines: Vaccine[];
  medications: Medication[];
  feeding: FeedingSchedule[];
  vetRecords: VetRecord[];
  expenses: Expense[];
  journal: JournalEntry[];
}

/** Escape user text before interpolating into the HTML document. */
function esc(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Local photos can't be embedded in an offline print document — note them. */
function photoNote(photoUri?: string): string {
  return photoUri ? ' <span class="tag">📷 photo on device</span>' : '';
}

/** Human "due in N days / N days ago / due today" suffix for vaccine due dates. */
function vaccineDueLine(v: Vaccine): string {
  if (!v.dueDate) return 'No due date set';
  const startOf = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const parse = (iso: string): Date => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  };
  const days = Math.round((parse(v.dueDate).getTime() - startOf(new Date()).getTime()) / 86400000);
  const status =
    days < 0
      ? `Overdue · ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
      : days === 0
        ? 'Due today'
        : days <= VACCINE_DUE_SOON_DAYS
          ? `Due soon · in ${days} day${days === 1 ? '' : 's'}`
          : `Up to date · due in ${days} day${days === 1 ? '' : 's'}`;
  return `Given ${esc(v.dateGiven)} · Next due ${esc(v.dueDate)} · ${status}`;
}

function profileRows(pet: Pet): string {
  const weight =
    typeof pet.weight === 'number' ? `${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}` : '—';
  const rows: Array<[string, string]> = [
    ['Species', esc(pet.species)],
    ['Breed', pet.breed ? esc(pet.breed) : '—'],
    ['Date of birth', pet.birthdate ? esc(pet.birthdate) : '—'],
    ['Weight', esc(weight)],
  ];
  return rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('');
}

/**
 * Build the complete "Pet File" HTML document for one pet.
 * Photos are referenced by note only (local file URIs don't embed offline).
 */
export function buildPetFileHtml(data: PetFileData): string {
  const { pet, vaccines, medications, feeding, vetRecords, expenses, journal } = data;
  const generatedOn = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const totalExpense = expenses.reduce(
    (sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0),
    0,
  );

  const section = (emoji: string, title: string, count: number, body: string): string => `
    <section>
      <h2>${emoji} ${title} · ${count}</h2>
      ${body}
    </section>`;

  const emptyNote = (noun: string): string =>
    `<p class="empty">No ${noun} recorded yet.</p>`;

  const vaccineBody =
    vaccines.length === 0
      ? emptyNote('vaccines')
      : `<ul>${vaccines
          .map(
            (v) => `<li><strong>${esc(v.name)}</strong><br/>
              <span class="meta">${vaccineDueLine(v)}${photoNote(v.photoUri)}</span>
              ${v.notes ? `<br/><span class="notes">${esc(v.notes)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`;

  const medBody =
    medications.length === 0
      ? emptyNote('medications')
      : `<ul>${medications
          .map(
            (m) => `<li><strong>${esc(m.name)}</strong> · ${esc(m.dosage)}<br/>
              <span class="meta">${esc(medicationScheduleLabel(m))}${
                m.active ? '' : ' · ended'
              }${photoNote(m.photoUri)}</span>
              ${m.notes ? `<br/><span class="notes">${esc(m.notes)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`;

  const feedingBody =
    feeding.length === 0
      ? emptyNote('feeding schedules')
      : `<ul>${feeding
          .map(
            (f) => `<li><strong>${esc(feedingScheduleLabel(f))}</strong><br/>
              <span class="meta">${esc(feedingDaysLabel(f.daysOfWeek))}${photoNote(f.photoUri)}</span>
              ${f.notes ? `<br/><span class="notes">${esc(f.notes)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`;

  const vetBody =
    vetRecords.length === 0
      ? emptyNote('vet records')
      : `<ul>${vetRecords
          .map(
            (r) => `<li><strong>${esc(r.visitTitle)}</strong> · ${esc(r.visitDate)}<br/>
              <span class="meta">${[r.clinicName, r.veterinarian].filter(Boolean).map(esc).join(' · ') || '—'}${
                typeof r.cost === 'number' && Number.isFinite(r.cost)
                  ? ` · cost ${esc(r.cost.toFixed(2))}`
                  : ''
              }${photoNote(r.photoUri)}</span>
              ${r.notes ? `<br/><span class="notes">${esc(r.notes)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`;

  const expenseBody =
    expenses.length === 0
      ? emptyNote('expenses')
      : `<p class="meta">Total: ${esc(expenseAmountLabel(totalExpense))}</p>
        <ul>${expenses
          .map(
            (e) => `<li><strong>${esc(e.title)}</strong> · ${esc(expenseAmountLabel(e.amount))} · ${esc(e.date)}<br/>
              <span class="meta">${esc(e.category)}${
                e.description ? ` · ${esc(e.description)}` : ''
              }${photoNote(e.photoUri)}</span>
              ${e.notes ? `<br/><span class="notes">${esc(e.notes)}</span>` : ''}</li>`,
          )
          .join('')}</ul>`;

  const journalBody =
    journal.length === 0
      ? emptyNote('journal entries')
      : `<ul>${journal
          .map(
            (j) => `<li><strong>${j.title ? esc(j.title) : esc(j.body.slice(0, 60))}</strong> · ${esc(j.entryDate)}${
              j.mood ? ` · ${esc(j.mood)}` : ''
            }${photoNote(j.photoUri)}<br/><span class="notes">${esc(j.body)}</span></li>`,
          )
          .join('')}</ul>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: sans-serif; background: #FAF4EA; color: #3F3226; padding: 32px; }
  .card { background: #FFFDF8; border: 1px solid #EBDDC8; border-radius: 12px; padding: 24px; }
  h1 { color: #D96C47; font-size: 28px; margin: 0 0 4px; }
  .subtitle { color: #8A7663; font-size: 13px; margin-bottom: 16px; }
  h2 { color: #B8552F; font-size: 18px; border-bottom: 2px solid #E9A13B; padding-bottom: 4px; margin-top: 28px; }
  table { border-collapse: collapse; margin-top: 8px; }
  th, td { text-align: left; padding: 4px 16px 4px 0; font-size: 14px; }
  th { color: #8A7663; font-weight: 600; }
  ul { padding-left: 20px; }
  li { font-size: 14px; margin-bottom: 10px; line-height: 1.5; }
  .meta { color: #8A7663; font-size: 13px; }
  .notes { color: #3F3226; font-size: 13px; }
  .tag { background: #FAF4EA; border: 1px solid #EBDDC8; border-radius: 8px; padding: 1px 6px; font-size: 11px; }
  .empty { color: #8A7663; font-style: italic; font-size: 14px; }
  .footer { color: #8A7663; font-size: 12px; margin-top: 32px; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <h1>🐾 ${esc(pet.name)} — Pet File</h1>
  <p class="subtitle">Pet Parent Tracker · generated on-device ${esc(generatedOn)} · all data stays on your phone${pet.photoUri ? ' · 📷 profile photo on device' : ''}</p>
  <table>${profileRows(pet)}</table>
  ${section('💉', 'Vaccines', vaccines.length, vaccineBody)}
  ${section('💊', 'Medications', medications.length, medBody)}
  ${section('🍖', 'Feeding', feeding.length, feedingBody)}
  ${section('🏥', 'Vet records', vetRecords.length, vetBody)}
  ${section('💰', 'Expenses', expenses.length, expenseBody)}
  ${section('📔', 'Journal', journal.length, journalBody)}
  <p class="footer">Made with 💛 by Pet Parent Tracker — 100% offline.</p>
</div>
</body>
</html>`;
}
