/**
 * The served documents, parsed into data — NEVER injected as HTML.
 *
 * WHY THIS FILE EXISTS. The document preview built the modal body as
 * `<pre>{renderedTemplate.content}</pre>`, so a reader who clicked "Settlement Statement" was shown
 * the document's MARKUP: a literal `# Document not issued / ...` and a literal `**NOT ISSUED.**`,
 * in monospace. The `prose prose-slate` wrapper above it emitted no CSS at all, because
 * `@tailwindcss/typography` is not a dependency of this client — the class names were decoration.
 * Measured from a real screen on 2026-10-29 (screenshot and text filed in
 * `screen-refusal-verify-2026-10-29.md`; the modal body read `# Document not issued`).
 *
 * WHAT THE SERVED DOCUMENTS ACTUALLY CONTAIN (counted at this revision, over
 * `templates/privacy-notice.md`, `templates/uae-employment-contract.md`,
 * `templates/ksa-employment-contract.md`, `templates/final-settlement-statement.md`):
 * `#`/`##`/`###` headings, `**bold**`, `- item` lists, `> quote` lines, `---` thematic breaks,
 * pipe tables with bilingual (English / Arabic) cells, and backtick code spans in the refusal body
 * (`server/compliance_engine.js:259`, which names the template and the record in backticks).
 * This module handles exactly those, and nothing else is consumed: any construct it does not
 * recognise stays in the output as literal text, so a new one is VISIBLE, never swallowed.
 *
 * THE RENDERER IS PURE DATA. It returns blocks and segments; `markdownView.js` turns them into React
 * elements. Nothing here can emit markup, so there is no `dangerouslySetInnerHTML` path to guard and
 * no escaping rule to remember.
 *
 * Output shape:
 *   block  ::= { type: 'heading', level: 1..6, inline: segment[] }
 *            | { type: 'paragraph', inline: segment[] }
 *            | { type: 'quote', lines: segment[][] }
 *            | { type: 'list', items: segment[][] }
 *            | { type: 'table', header: segment[][], rows: segment[][][] }
 *            | { type: 'codeblock', lines: string[] }
 *            | { type: 'rule' }
 *   segment ::= { type: 'text',   value: string }
 *             | { type: 'strong', value: string }
 *             | { type: 'code',   value: string }
 *             | { type: 'link',   text: string, href: string }
 *
 * `src/markdown.test.js` asserts, on the real template bytes and on the refusal body, that the
 * rendered text equals the served content with the markers removed.
 */

const HEADING = /^(#{1,6})\s+(.*)$/;
const THEMATIC_BREAK = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const FENCE = /^\s{0,3}(?:```|~~~)/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_DELIMITER = /^\s*\|[\s:|-]+\|\s*$/;
const BLANK = /^\s*$/;
/** `` `code` `` | `**strong**` | `[label](href)`, scanned left to right in one pass. */
const INLINE = /(`[^`]*`)|(\*\*[\s\S]+?\*\*)|(\[[^\]]*\]\([^)]*\))/g;
const SAFE_HREF = /^(?:https?:\/\/|mailto:)/i;

/** `[label](href)` -> its parts, so a link can keep its label without inventing one. */
function splitLink(token) {
  const close = token.indexOf('](');
  return {
    text: token.slice(1, close),
    href: token.slice(close + 2, -1).trim(),
  };
}

/**
 * A link's label is the part a reader must not lose; a destination that is not http(s)/mailto is
 * kept out of the `href` ATTRIBUTE (a `javascript:` URL is not a document) but is never dropped
 * from the text — `markdownView.js` renders that one as its own source text.
 */
export function isRenderableHref(href) {
  return SAFE_HREF.test(String(href || ''));
}

/** One line of served text -> segments. Unrecognised markers stay literal text. */
export function parseInline(text) {
  const source = String(text == null ? '' : text);
  if (source === '') return [];
  const out = [];
  let last = 0;
  const re = new RegExp(INLINE.source, 'g');
  let m;
  while ((m = re.exec(source)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: source.slice(last, m.index) });
    const token = m[0];
    if (token.startsWith('`')) out.push({ type: 'code', value: token.slice(1, -1) });
    else if (token.startsWith('**')) out.push({ type: 'strong', value: token.slice(2, -2) });
    else out.push(Object.assign({ type: 'link' }, splitLink(token)));
    last = m.index + token.length;
  }
  if (last < source.length) out.push({ type: 'text', value: source.slice(last) });
  return out;
}

/** A table line -> its cells, still as source text. */
function cellsOf(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((cell) => cell.trim());
}

function isTableStart(lines, i) {
  return TABLE_ROW.test(lines[i]) && i + 1 < lines.length && TABLE_DELIMITER.test(lines[i + 1]);
}

function isBlockStart(lines, i) {
  const line = lines[i];
  return BLANK.test(line)
    || FENCE.test(line)
    || HEADING.test(line)
    || THEMATIC_BREAK.test(line)
    || QUOTE.test(line)
    || BULLET.test(line)
    || isTableStart(lines, i);
}

/** Served content -> blocks. Nothing is dropped: an unknown line becomes a paragraph. */
export function parseBlocks(content) {
  const lines = String(content == null ? '' : content).split(/\r?\n/);
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (BLANK.test(line)) { i += 1; continue; }

    if (FENCE.test(line)) {
      const body = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) { body.push(lines[i]); i += 1; }
      if (i < lines.length) i += 1; // the closing fence is a marker, not text
      blocks.push({ type: 'codeblock', lines: body });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, inline: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }

    if (THEMATIC_BREAK.test(line)) { blocks.push({ type: 'rule' }); i += 1; continue; }

    if (QUOTE.test(line)) {
      const quoted = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push(parseInline(QUOTE.exec(lines[i])[1].trim()));
        i += 1;
      }
      blocks.push({ type: 'quote', lines: quoted });
      continue;
    }

    if (BULLET.test(line)) {
      const items = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(parseInline(BULLET.exec(lines[i])[1].trim()));
        i += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = cellsOf(lines[i]).map(parseInline);
      i += 2; // the delimiter row is a marker, not a row
      const rows = [];
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(cellsOf(lines[i]).map(parseInline));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (i < lines.length && !isBlockStart(lines, i)) { paragraph.push(lines[i].trim()); i += 1; }
    blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) });
  }
  return blocks;
}

export { BULLET, HEADING, QUOTE, TABLE_DELIMITER, TABLE_ROW, THEMATIC_BREAK };
