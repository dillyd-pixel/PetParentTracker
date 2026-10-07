/**
 * Pet Memorial Book — the print HTML template.
 *
 * `buildMemorialHtml()` renders a `MemorialDocument` (see ./document) into ONE
 * self-contained HTML string: inline CSS only, no images, no webfonts, no
 * scripts, no URLs. `expo-print`'s `printToFileAsync` turns that string into a
 * PDF on the device, and the same string is what the browser preview renders in
 * an inline frame and prints from the browser's own dialog — so the printed
 * page and the preview are the same book.
 *
 * Brand: the Command Center's keepsake voice — Warm Ivory paper, Deep Ink text,
 * serif headings (the "The Blueprint" look), and the memories gradient
 * (Coral #FF6B78 → Lavender #9B78FF) as the book's accent: a bar across the
 * cover and a rule above every section. Both gradient and fill carry a solid
 * fallback colour, so a printer that drops the gradient still prints a clean
 * rule rather than nothing.
 *
 * Paper size: the `@page` rule carries the chosen size (letter or A4) AND the
 * body carries a size class, so switching paper changes both the page box and
 * the type scale — correct on native print-to-file and in the browser alike.
 *
 * 100% offline: a pure string function. No fetch, no remote anything.
 */
import { paperSizeDef } from '../planner/sections';
import type { MemorialBlock, MemorialDocument, MemorialTimelineEntry } from './document';

/** Escape user text (including the owner's own note) before it reaches the page. */
function esc(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escaped text with the owner's own line breaks kept. */
function escLines(value: string): string {
  return esc(value).replace(/\r?\n/g, '<br />');
}

/** Print-safe font stacks: generic serif for headings, plain sans for body. */
const CSS = (pageSize: string): string => `
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
  .paper--letter { font-size: 10.5pt; line-height: 1.45; }
  .paper--a4 { font-size: 10pt; line-height: 1.42; }

  /* ---- the memories rule: solid fallback first, gradient on top ---- */
  .rule {
    height: 3px;
    border-radius: 2px;
    background-color: #9B78FF;
    background-image: linear-gradient(90deg, #FF6B78, #9B78FF);
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* ---- cover ---- */
  .cover { margin-bottom: 8px; }
  .cover .rule { height: 7px; margin-bottom: 10px; }
  .kicker {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 8pt;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #6B45D9;
    margin: 0;
  }
  h1.title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 26pt;
    line-height: 1.12;
    color: #202126;
    margin: 5px 0 4px;
  }
  .pet-emoji { font-size: 22pt; }
  .pet-meta { color: #5A5B62; font-size: 9.5pt; margin: 0 0 4px; }
  .subtitle { color: #5A5B62; font-size: 9pt; margin: 0; }
  .index { color: #5A5B62; font-size: 8.5pt; margin: 6px 0 0; }

  /* ---- sections ---- */
  .section {
    margin-top: 14px;
    padding: 9px 11px 12px;
    border: 1px solid #EDE3D2;
    border-radius: 10px;
    background: #FFFEFA;
    contain: paint;
    break-before: auto;
    page-break-before: auto;
  }
  .section .rule { height: 3px; margin-bottom: 6px; }
  h2.section-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 13pt;
    color: #4A2FA8;
    margin: 0 0 4px;
    break-after: avoid;
    page-break-after: avoid;
  }
  .sub {
    font-weight: 700;
    font-size: 9.5pt;
    color: #202126;
    margin: 9px 0 2px;
    break-after: avoid;
  }
  .line { margin: 4px 0; }
  .empty { color: #5A5B62; font-style: italic; margin: 4px 0; }
  .lead { color: #5A5B62; font-size: 9.5pt; margin: 4px 0 2px; }

  /* ---- key/value ledger ---- */
  table.kv { width: 100%; border-collapse: collapse; margin: 4px 0 2px; }
  table.kv th {
    width: 32%;
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

  /* ---- memories, entries, milestones ---- */
  ul.list { list-style: none; margin: 5px 0; padding: 0; }
  ul.list li {
    border-left: 2.5px solid #9B78FF;
    padding: 1px 0 1px 8px;
    margin: 0 0 8px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .li-title { font-weight: 700; }
  .meta { display: block; color: #5A5B62; font-size: 8.5pt; }
  .note { display: block; font-size: 9pt; color: #202126; }

  /* ---- the lifetime timeline ---- */
  ul.timeline { list-style: none; margin: 6px 0 0; padding: 0; }
  ul.timeline li {
    display: flex;
    gap: 8px;
    padding: 5px 0;
    border-bottom: 1px solid #F0E9DA;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .tl-date {
    width: 26%;
    flex: 0 0 26%;
    color: #5A5B62;
    font-size: 8.5pt;
    padding-top: 1px;
  }
  .tl-body { flex: 1; }
  .tl-title { font-weight: 700; font-size: 9.5pt; }
  .tl-meta { display: block; color: #5A5B62; font-size: 8.5pt; }
  .tl-note { display: block; font-size: 9pt; color: #202126; }
  .hint { color: #5A5B62; font-size: 8pt; margin: 5px 0 0; font-style: italic; }

  /* ---- the photo frame ---- */
  .frame {
    border: 1.5px dashed #C9BFA8;
    border-radius: 10px;
    background: #FBF6EC;
    margin: 8px 0 4px;
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #5A5B62;
    font-size: 9.5pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .frame--tall { height: 88mm; }

  /* ---- the letter ---- */
  .letter {
    border: 1px solid #EDD9DC;
    border-left: 4px solid #FF6B78;
    border-radius: 10px;
    background: #FFFBF8;
    padding: 12px 14px;
    margin: 6px 0 0;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .letter-body {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11.5pt;
    line-height: 1.6;
    color: #202126;
    margin: 0;
  }
  .letter-body--waiting { color: #5A5B62; font-style: italic; font-size: 10.5pt; }
  .sign-off {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    color: #4A2FA8;
    margin: 10px 0 0;
    text-align: right;
  }
  .write-lines { margin: 4px 0 0; }
  .write-lines div { border-bottom: 1px dashed #D9CFBA; height: 26px; }

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

/** One timeline row: the date on the left, the moment on the right. */
function renderTimelineEntry(entry: MemorialTimelineEntry): string {
  return `
    <li>
      <span class="tl-date">${esc(entry.dateLabel)}</span>
      <span class="tl-body">
        <span class="tl-title">${esc(entry.emoji)} ${esc(entry.title)}</span>
        ${entry.meta ? `<span class="tl-meta">${esc(entry.meta)}</span>` : ''}
        ${entry.note ? `<span class="tl-note">${esc(entry.note)}</span>` : ''}
      </span>
    </li>`;
}

/** One block, by kind. */
function renderBlock(block: MemorialBlock): string {
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
          }${item.note ? `<span class="note">${escLines(item.note)}</span>` : ''}</li>`,
        )
        .join('')}</ul>`;
    case 'timeline':
      return `
        <ul class="timeline">${block.entries.map(renderTimelineEntry).join('')}</ul>
        ${block.note ? `<p class="hint">${esc(block.note)}</p>` : ''}`;
    case 'frame':
      return `<div class="frame${block.tall ? ' frame--tall' : ''}">${esc(block.text)}</div>`;
    case 'letter':
      return `
        <div class="letter">
          <p class="letter-body${block.muted ? ' letter-body--waiting' : ''}">${escLines(
            block.text,
          )}</p>
          ${
            block.ruleLines && block.ruleLines > 0
              ? `<div class="write-lines">${'<div></div>'.repeat(block.ruleLines)}</div>`
              : ''
          }
          ${block.signOff ? `<p class="sign-off">${esc(block.signOff)}</p>` : ''}
        </div>`;
    default:
      return '';
  }
}

/**
 * The complete memorial book as print HTML. Deterministic: the same document
 * model always produces the same string.
 */
export function buildMemorialHtml(doc: MemorialDocument): string {
  const paper = paperSizeDef(doc.paper);
  const sizeClass = doc.paper === 'a4' ? 'paper--a4' : 'paper--letter';

  const sections = doc.sections
    .map(
      (section) => `
    <section class="section">
      <div class="rule"></div>
      <h2 class="section-title">${esc(section.emoji)} ${esc(section.title)}</h2>
      ${section.blocks.map(renderBlock).join('')}
    </section>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(doc.title)}</title>
<style>${CSS(paper.cssPageSize)}</style>
</head>
<body>
<div class="paper ${sizeClass}">
  <div class="cover">
    <div class="rule"></div>
    <p class="kicker">${esc(doc.kicker)}</p>
    <h1 class="title">${doc.petEmoji ? `<span class="pet-emoji">${esc(doc.petEmoji)}</span> ` : ''}${esc(
      doc.title,
    )}</h1>
    ${doc.petMeta ? `<p class="pet-meta">${esc(doc.petMeta)}</p>` : ''}
    <p class="subtitle">${esc(doc.subtitle)}</p>
    ${
      doc.sectionTitles.length > 0
        ? `<p class="index">Inside: ${esc(doc.sectionTitles.join(' · '))}</p>`
        : ''
    }
  </div>
  ${sections}
  <p class="footer">Made with 💛 by Pet Parent Tracker — kept on this device, printed at home. Nothing was uploaded, and nothing left your phone.</p>
</div>
</body>
</html>`;
}
