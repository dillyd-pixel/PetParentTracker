/**
 * Printable Pet Planner — the print HTML template.
 *
 * `buildPlannerHtml()` renders a `PlannerDocument` (see ./document) into ONE
 * self-contained HTML string: inline CSS only, no images, no webfonts, no
 * scripts, no URLs. `expo-print`'s `printToFileAsync` turns that string into a
 * PDF on the device, and the same string is what the browser preview renders in
 * an iframe and prints from the browser's own dialog — so the printed page and
 * the preview are the same document.
 *
 * Brand: Warm Ivory page, Deep Ink text, Blueprint Blue headings, Electric Aqua
 * keylines, and the serif/sans split of the Command Center — a generic serif
 * stack for headings ("The Blueprint" look) and a plain sans for body text.
 * Both are print-safe system families: nothing is downloaded at runtime.
 *
 * Paper size: the `@page` rule carries the chosen size (letter or A4) AND the
 * body carries a size class, so switching paper changes both the page box and
 * the type scale — correct on native print-to-file and in the browser alike.
 *
 * 100% offline: a pure string function. No fetch, no remote anything.
 */
import { paperSizeDef } from './sections';
import type { PlannerBlock, PlannerDocument, PlannerMonth } from './document';

/** Escape user text before it goes anywhere near the document. */
function esc(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print-safe font stacks: generic serif for headings, plain sans for body. */
const CSS = (pageSize: string, sizeClass: string): string => `
  @page { size: ${pageSize}; margin: 14mm 13mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: #FFFDF8;
    color: #202126;
    font-family: Helvetica, Arial, "Helvetica Neue", sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .paper { padding: 0; }
  .paper--letter { font-size: 10.5pt; line-height: 1.45; }
  .paper--a4 { font-size: 10pt; line-height: 1.42; }

  /* ---- cover ---- */
  .cover { border-bottom: 3px solid #246BFD; padding-bottom: 10px; margin-bottom: 14px; }
  .kicker {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 8pt;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #246BFD;
    margin: 0;
  }
  h1.title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 25pt;
    line-height: 1.12;
    color: #202126;
    margin: 5px 0 4px;
  }
  .subtitle { color: #5A5B62; font-size: 9pt; margin: 0; }
  .index { color: #5A5B62; font-size: 8.5pt; margin: 6px 0 0; }

  /* ---- chapters & sections ---- */
  .chapter { margin-top: 20px; }
  .chapter--break { break-before: page; page-break-before: always; }
  .chapter-head { break-after: avoid; page-break-after: avoid; }
  h2.pet {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 17pt;
    color: #202126;
    margin: 0 0 2px;
    border-bottom: 2px solid #31D7D7;
    padding-bottom: 4px;
  }
  .pet-meta { color: #5A5B62; font-size: 9pt; margin: 0 0 4px; }
  .section { margin-top: 13px; }
  h3.section-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12.5pt;
    color: #1544B5;
    margin: 14px 0 4px;
    padding-bottom: 2px;
    border-bottom: 1.2px solid #31D7D7;
    break-after: avoid;
    page-break-after: avoid;
  }
  .sub { font-weight: 700; font-size: 10pt; color: #202126; margin: 9px 0 2px; break-after: avoid; }
  .line { margin: 4px 0; }
  .empty { color: #5A5B62; font-style: italic; margin: 4px 0; }

  /* ---- key/value ledger ---- */
  table.kv { width: 100%; border-collapse: collapse; margin: 4px 0 2px; }
  table.kv th {
    width: 30%;
    text-align: left;
    vertical-align: top;
    font-weight: 600;
    color: #5A5B62;
    font-size: 9pt;
    padding: 3px 10px 3px 0;
    border-bottom: 1px solid #EDE6D8;
  }
  table.kv td {
    vertical-align: top;
    padding: 3px 0;
    border-bottom: 1px solid #EDE6D8;
    break-inside: avoid;
  }

  /* ---- record lists ---- */
  ul.list { list-style: none; margin: 5px 0; padding: 0; }
  ul.list li {
    border-left: 2.5px solid #31D7D7;
    padding: 1px 0 1px 8px;
    margin: 0 0 8px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .li-title { font-weight: 700; }
  .meta { display: block; color: #5A5B62; font-size: 8.5pt; }
  .note { display: block; font-size: 9pt; color: #202126; }

  /* ---- write-in logs ---- */
  table.log { width: 100%; border-collapse: collapse; margin: 5px 0 0; }
  table.log th {
    text-align: left;
    font-size: 7.5pt;
    letter-spacing: 0.7px;
    text-transform: uppercase;
    color: #1544B5;
    border-bottom: 1px solid #246BFD;
    padding: 2px 8px 4px 0;
  }
  table.log td {
    border-bottom: 1px solid #E4DCCB;
    height: 15px;
    padding: 5px 8px 5px 0;
    font-size: 9.5pt;
    vertical-align: bottom;
    break-inside: avoid;
  }
  .hint { color: #5A5B62; font-size: 8pt; margin: 3px 0 0; font-style: italic; }

  /* ---- monthly calendar ---- */
  .months { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 6px; }
  .month {
    width: calc(50% - 4px);
    border: 1px solid #E4DCCB;
    border-radius: 6px;
    padding: 6px 7px 7px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .month-name {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 700;
    font-size: 9.5pt;
    color: #1544B5;
    margin: 0 0 3px;
  }
  table.grid { width: 100%; border-collapse: collapse; }
  table.grid th { font-size: 7pt; font-weight: 600; color: #5A5B62; text-align: center; }
  table.grid td {
    text-align: center;
    vertical-align: top;
    font-size: 8.5pt;
    height: 20px;
    padding: 1px 0 0;
  }
  table.grid td.has { background: #FBF6EC; border-radius: 3px; }
  .mark { display: block; font-size: 6.5pt; line-height: 1; }
  .legend { color: #5A5B62; font-size: 8pt; margin: 5px 0 0; }

  /* ---- photo frame ---- */
  .frame {
    border: 1.5px dashed #C9BFA8;
    border-radius: 8px;
    height: 40mm;
    margin: 8px 0 0;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #5A5B62;
    font-size: 9pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* ---- footer ---- */
  .footer {
    margin-top: 16px;
    padding-top: 7px;
    border-top: 1px solid #E4DCCB;
    color: #5A5B62;
    font-size: 8pt;
    text-align: center;
  }
`;

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** One month's blank grid, with the pet's known dates marked on their days. */
function renderMonth(month: PlannerMonth): string {
  const cells: string[] = [];
  for (let i = 0; i < month.firstWeekday; i += 1) cells.push('<td></td>');
  for (let day = 1; day <= month.daysInMonth; day += 1) {
    const marks = month.marks[day];
    const glyphs = marks ? `<span class="mark">${esc(marks.join(''))}</span>` : '';
    cells.push(
      `<td class="${marks ? 'has' : ''}">${day}${glyphs}</td>`,
    );
  }
  while (cells.length % 7 !== 0) cells.push('<td></td>');

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(`<tr>${cells.slice(i, i + 7).join('')}</tr>`);
  }

  return `
    <div class="month">
      <p class="month-name">${esc(month.label)}</p>
      <table class="grid">
        <thead><tr>${WEEKDAYS.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

/** One block, by kind. */
function renderBlock(block: PlannerBlock): string {
  switch (block.kind) {
    case 'text':
      return `<p class="${block.muted ? 'empty' : 'line'}">${esc(block.text)}</p>`;
    case 'subheading':
      return `<p class="sub">${esc(block.text)}</p>`;
    case 'kv':
      return `<table class="kv"><tbody>${block.rows
        .map((row) => `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td></tr>`)
        .join('')}</tbody></table>`;
    case 'list':
      return `<ul class="list">${block.items
        .map(
          (item) => `<li><span class="li-title">${esc(item.title)}</span>${
            item.meta ? `<span class="meta">${esc(item.meta)}</span>` : ''
          }${item.note ? `<span class="note">${esc(item.note)}</span>` : ''}</li>`,
        )
        .join('')}</ul>`;
    case 'log':
      return `
        <table class="log">
          <thead><tr>${block.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${block.rows
            .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
            .join('')}</tbody>
        </table>
        ${block.hint ? `<p class="hint">${esc(block.hint)}</p>` : ''}`;
    case 'calendar':
      return `
        <div class="months">${block.months.map(renderMonth).join('')}</div>
        ${
          block.legend.length > 0
            ? `<p class="legend">Key: ${block.legend
                .map((entry) => `${esc(entry.emoji)} ${esc(entry.label)}`)
                .join(' · ')}</p>`
            : ''
        }`;
    case 'frame':
      return `<div class="frame">${esc(block.text)}</div>`;
    default:
      return '';
  }
}

/**
 * The complete planner document as print HTML. Deterministic: the same
 * document model always produces the same string.
 */
export function buildPlannerHtml(doc: PlannerDocument): string {
  const paper = paperSizeDef(doc.paper);
  const sizeClass = doc.paper === 'a4' ? 'paper--a4' : 'paper--letter';

  const chapters = doc.chapters
    .map(
      (chapter, index) => `
    <section class="chapter${index > 0 ? ' chapter--break' : ''}">
      <div class="chapter-head">
        <h2 class="pet">${esc(chapter.petEmoji)} ${esc(chapter.petName)}</h2>
        <p class="pet-meta">${esc(chapter.meta)}</p>
      </div>
      ${chapter.sections
        .map(
          (section) => `
      <div class="section">
        <h3 class="section-title">${esc(section.emoji)} ${esc(section.title)}</h3>
        ${section.blocks.map(renderBlock).join('')}
      </div>`,
        )
        .join('')}
    </section>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(doc.title)}</title>
<style>${CSS(paper.cssPageSize, sizeClass)}</style>
</head>
<body>
<div class="paper ${sizeClass}">
  <div class="cover">
    <p class="kicker">${esc(doc.kicker)}</p>
    <h1 class="title">${esc(doc.title)}</h1>
    <p class="subtitle">${esc(doc.subtitle)}</p>
    <p class="index">Inside: ${esc(doc.sectionTitles.join(' · '))}</p>
  </div>
  ${chapters}
  <p class="footer">Made with 💛 by Pet Parent Tracker — printed at home, nothing left the device.</p>
</div>
</body>
</html>`;
}
