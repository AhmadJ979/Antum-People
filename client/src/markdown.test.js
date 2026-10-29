/**
 * THE DOCUMENT MUST RENDER AS A DOCUMENT — and its visible text must be the served text.
 *
 * The defect this file guards: the preview built its body as `<pre>{content}</pre>`, so a reader who
 * clicked "Settlement Statement" on a terminated employee saw the document's MARKUP — a literal
 * `# Document not issued / ...` and a literal `**NOT ISSUED.**` in monospace (real screen, 2026-10-29;
 * `screen-refusal-verify-2026-10-29.md`). The `prose prose-slate` wrapper emitted no CSS at all
 * because `@tailwindcss/typography` is not a dependency of this client.
 *
 * What is asserted, and how:
 *   - the content is rendered through the REAL view (`markdownView.js`) with `react-dom/server`, so
 *     this is the markup a browser would receive, not a re-description of it;
 *   - `stripMarkers()` below is an INDEPENDENT statement of which characters are markers — heading
 *     hashes, the quote/ bullet/ table pipes, `**`, backticks, alignment rows, thematic breaks, and a
 *     link's destination — and the rendered text must equal what is left, whitespace normalised.
 *     Nothing dropped, nothing reordered, nothing invented, no character swallowed;
 *   - the real template BYTES are used (`templates/*.md`), not a fixture, so a construct the renderer
 *     does not handle shows up here rather than on a reader's screen;
 *   - two MUTANT controls prove the comparison can redden: a tree with one character removed and one
 *     with a character added must both fail it. A check that cannot redden proves nothing.
 *
 * WHERE IT CANNOT SEE (stated so nobody reads it as more): an unrecognised marker stays as literal
 * text — visible on screen, not swallowed — and the comparison treats it as content, so nothing
 * reddens here for it. That is the safe direction, and it is a limit, not a proof.
 *
 * Run: `cd client && npm test`   (node --test; no browser, no DOM — `react-dom/server` renders to a
 * string, which is why the view is a plain module using `createElement` and not a `.tsx` file).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseBlocks } from './markdown.js';
import { MarkdownDocument, renderBlocks } from './markdownView.js';

const SRC = import.meta.dirname;
const REPO = path.resolve(SRC, '..', '..');
const TEMPLATES = [
  'final-settlement-statement.md',
  'uae-employment-contract.md',
  'ksa-employment-contract.md',
  'privacy-notice.md',
];

const templateText = (name) => fs.readFileSync(path.join(REPO, 'templates', name), 'utf8');

/**
 * The refusal body, quoted from `server/compliance_engine.js:259` (`refusalDocument`). It is a COPY:
 * the two strings that make it a refusal are re-read from that file below, so a rewrite of the body
 * reddens here instead of quietly making this fixture describe a response we no longer send.
 */
const REFUSAL_ARABIC = '\u0644\u0645 \u064a\u062a\u0645 \u0625\u0635\u062f\u0627\u0631 \u0627\u0644\u0645\u0633\u062a\u0646\u062f';
function refusalBody({ templateName, employeeId, missing }) {
  return [
    '# Document not issued / ' + REFUSAL_ARABIC,
    '',
    '**NOT ISSUED.** This response is not the document you asked for. It contains no clause, no',
    'signature block and no figure, and nothing in it may be read, signed or presented as one.',
    '',
    'The document `' + templateName + '`, for the record `' + employeeId + '`, states facts that no',
    'record in this product holds. Filling such a hole with a plausible licence number, a party name',
    'or a 0.00 is what we will not do, so the document is withheld until the facts are recorded:',
    '',
    ...missing.map((fact) => '- ' + fact),
    '',
    'Record them and request the document again. The employer-side facts are the employer own',
    'identity and registration; the rest are amounts and terms the employee record does not carry.',
  ].join('\n');
}

/** The serving state the reader photographed: the settlement statement, refused for want of facts. */
const REFUSAL = refusalBody({
  templateName: 'final-settlement-statement',
  employeeId: 'e1',
  missing: [
    'Employer legal name', 'Employer address', 'Accrued leave amount', 'Notice pay',
    'Ticket allowance', 'Total deductions', 'Net payable',
  ],
});

const ALIGNMENT_ROW = /^\s*\|[\s:|-]+\|\s*$/;
const RULE = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE = /^\s{0,3}(?:```|~~~)/;

/** The served content with the markers removed — this file's own statement of what may disappear. */
function stripMarkers(content) {
  const out = [];
  let inFence = false;
  for (const line of String(content).split(/\r?\n/)) {
    if (FENCE.test(line)) { inFence = !inFence; continue; }
    if (inFence) { out.push(line); continue; }
    if (/^\s*$/.test(line)) continue;
    if (ALIGNMENT_ROW.test(line)) continue;
    if (RULE.test(line)) continue;
    out.push(
      line
        .replace(/^#{1,6}\s+/, '')
        .replace(/^\s{0,3}>\s?/, '')
        .replace(/^\s{0,3}[-*+]\s+/, '')
        .replace(/\|/g, '')
        .replace(/\*\*/g, '')
        .replace(/`/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'),
    );
  }
  return out.join('\n');
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X'
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : whole;
  });
}

/** Markup -> the text a reader sees. Block ends become a space; inline ends must NOT. */
function textOfHtml(html) {
  return decodeEntities(
    html
      .replace(/<\/(?:p|div|li|h[1-6]|td|th|tr|blockquote|table|thead|tbody|ul|ol|pre)>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  );
}

/** Code with its comments removed, for the scans that must not read their own explanation. */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Every module the client can bundle, DISCOVERED by walking `src/` - never a list of filenames.
 *
 * The narrow form of this guard named `markdown.js` and `markdownView.js`, and that was a defect of
 * the class rule 8 names: it passed for a reason that said nothing about the served bytes - it
 * happened to name the only two files that mattered on the day it was written. A new module
 * printing a document's `content` in a `<pre>` was invisible to it. The walk is the fix: a file is in
 * scope because of where it lives, so a file that does not exist yet is already covered.
 * Test files are excluded by design - they are not bundled, and this file's own mutant strings would
 * otherwise be read as violations of it.
 */
function clientModules() {
  const skip = new Set(['node_modules', 'dist', '__tests__']);
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) walk(full);
        continue;
      }
      if (!/\.(?:js|jsx|ts|tsx|mjs)$/.test(entry.name)) continue;
      if (/\.(?:test|spec)\./.test(entry.name)) continue;
      out.push(path.relative(SRC, full));
    }
  };
  walk(SRC);
  return out.sort();
}

const markupOf = (element) => renderToStaticMarkup(element);
const textOfBlocks = (blocks) => textOfHtml(markupOf(React.createElement('div', null, renderBlocks(blocks))));
const renderedText = (content) => textOfHtml(markupOf(React.createElement(MarkdownDocument, { content })));

const squash = (text) => text.replace(/\s+/g, ' ').trim();

/** The one comparison every serving state is held to. Returns a message, or '' when it holds. */
function textMismatch(rendered, served) {
  const expected = squash(stripMarkers(served));
  const actual = squash(rendered);
  if (expected === actual) return '';
  let at = 0;
  while (at < expected.length && at < actual.length && expected[at] === actual[at]) at += 1;
  return `first difference at character ${at}: rendered ${JSON.stringify(actual.slice(at, at + 60))}`
    + ` vs served-minus-markers ${JSON.stringify(expected.slice(at, at + 60))}`;
}

describe('the served documents render as documents, with their text intact', () => {
  for (const name of TEMPLATES) {
    test(`${name}: no character dropped, reordered or invented`, () => {
      const served = templateText(name);
      assert.ok(served.length > 500, `${name} is ${served.length} bytes — not the served document`);
      assert.equal(textMismatch(renderedText(served), served), '');
    });
  }

  test('the constructs the documents use are elements, not literal markers', () => {
    const html = markupOf(React.createElement(MarkdownDocument, { content: templateText('uae-employment-contract.md') }));
    assert.match(html, /<h1[^>]*>/, 'a level-1 heading is rendered as a heading');
    assert.match(html, /<h3[^>]*>/);
    assert.match(html, /<strong[^>]*>/);
    assert.match(html, /<blockquote[^>]*>/);
    assert.match(html, /<table[^>]*>/);
    assert.match(html, /<td[^>]*>/);
    const visible = textOfHtml(html);
    for (const marker of ['**', '| ---', '###', '# Final', '> **']) {
      assert.ok(!visible.includes(marker), `the raw marker ${JSON.stringify(marker)} reached the reader`);
    }
  });

  test('every table cell keeps its text, Arabic included', () => {
    const served = templateText('final-settlement-statement.md');
    const blocks = parseBlocks(served);
    const table = blocks.find((b) => b.type === 'table');
    assert.ok(table, 'the settlement statement has a table');
    const heading = blocks.find((b) => b.type === 'heading');
    const headingText = heading.inline.map((s) => s.value).join('');
    // The bilingual heading, quoted from the document's own first line, must survive whole.
    assert.ok(headingText.startsWith('Final Settlement Statement / '), headingText);
    const visible = renderedText(served);
    assert.ok(
      visible.includes('End of Service Benefit (EOSB) / \u0645\u0643\u0627\u0641\u0623\u0629 \u0646\u0647\u0627\u064a\u0629 \u0627\u0644\u062e\u062f\u0645\u0629'),
      'a bilingual cell lost its text',
    );
  });
});

describe('the refusal path stays legible', () => {
  test('the refusal body renders as prose and every fact it names survives', () => {
    assert.equal(textMismatch(renderedText(REFUSAL), REFUSAL), '');
    const visible = renderedText(REFUSAL);
    assert.ok(visible.includes('Document not issued / ' + REFUSAL_ARABIC));
    for (const fact of ['Employer legal name', 'Total deductions', 'Net payable']) {
      assert.ok(visible.includes(fact), `the refusal stopped naming ${fact}`);
    }
  });

  test('**NOT ISSUED.** is a sentence, NOT a heading claiming the opposite', () => {
    const blocks = parseBlocks(REFUSAL);
    const headings = blocks.filter((b) => b.type === 'heading')
      .map((b) => b.inline.map((s) => s.value).join(''));
    assert.deepEqual(headings, ['Document not issued / ' + REFUSAL_ARABIC]);
    for (const heading of headings) {
      assert.ok(!heading.includes('NOT ISSUED'), 'the refusal became a heading that reads as issued');
    }
    const paragraph = blocks.find((b) => b.type === 'paragraph'
      && b.inline.some((s) => s.type === 'strong' && s.value === 'NOT ISSUED.'));
    assert.ok(paragraph, 'the NOT ISSUED sentence is a paragraph carrying a bold span');
    const html = markupOf(React.createElement(MarkdownDocument, { content: REFUSAL }));
    assert.ok(!/<h[1-6][^>]*>(?:(?!<\/h[1-6]>)[\s\S])*NOT ISSUED/.test(html),
      'no heading element contains NOT ISSUED');
    assert.match(html, /<strong[^>]*>NOT ISSUED\.<\/strong>/);
  });

  test('the refusal body this file quotes is still the one the route sends', () => {
    const server = fs.readFileSync(path.join(REPO, 'server', 'compliance_engine.js'), 'utf8');
    // What this catches: the refusal body being REPLACED (a rendered template, a table, a status
    // object). What it does not: a reworded sentence around these lines, which the fixture would
    // then describe slightly stale — the text comparison above still holds for what IS quoted.
    assert.ok(server.includes("'# Document not issued / "), 'the refusal heading line moved or was reworded');
    assert.ok(server.includes("'**NOT ISSUED.** This response is not the document you asked for."),
      'the refusal sentence moved or was reworded');
  });
});

describe('there is no markup path', () => {
  test('a tag in the served text is shown, never executed', () => {
    const hostile = '# Heading\n\n<img src=x onerror="alert(1)"> and **bold**';
    const html = markupOf(React.createElement(MarkdownDocument, { content: hostile }));
    assert.ok(html.includes('&lt;img'), 'the tag was not escaped');
    assert.ok(!html.includes('<img'), 'a real img element was created');
    assert.ok(textOfHtml(html).includes('<img src=x onerror="alert(1)">'), 'the text was not preserved');
  });

  test('the parser returns data only, and the view never injects HTML', () => {
    const blocks = parseBlocks('# h\n- a\n| x | y |\n|---|---|\n| 1 | 2 |\n> q\n---\n`c` [l](https://example.com)');
    const known = new Set(['heading', 'paragraph', 'quote', 'list', 'table', 'codeblock', 'rule']);
    for (const block of blocks) assert.ok(known.has(block.type), `unknown block type ${block.type}`);
    const segments = new Set(['text', 'strong', 'code', 'link']);
    for (const block of blocks) {
      const lists = block.inline ? [block.inline] : block.items || block.lines || [];
      for (const list of lists) for (const s of list) assert.ok(segments.has(s.type), `unknown segment ${s.type}`);
      assert.equal(block.html, undefined, 'a block carried raw html');
    }
    // The scan is over EVERY module the client bundles (see `clientModules`), not two filenames.
    // `scripts/check-served-document-renderer.py` is the wider guard - it also refuses a `pre`/`code`
    // element outside the renderer and a served body printed anywhere but through MarkdownDocument,
    // and it walks this same tree from the operator's entry point. This half stays because the client
    // suite is run on its own, and a suite that passes a bypass is the defect this PR closes.
    const modules = clientModules();
    assert.ok(modules.length >= 5,
      `the walk found ${modules.length} module(s) under src/ - a scan with nothing to read is not a pass`);
    assert.ok(modules.includes('App.tsx'), 'the walk must reach App.tsx, where served content is printed');
    for (const file of modules) {
      // The scan reads CODE only: the modules explain in prose that they avoid HTML injection, and a
      // check that scans its own explanation reddens on a correct tree (the same trap the stylesheet's
      // source guard documents, in `tailwindSources.test.js`).
      const source = withoutComments(fs.readFileSync(path.join(SRC, file), 'utf8'));
      assert.ok(!source.includes('dangerouslySetInnerHTML'), `${file} can inject html`);
      assert.ok(!/\.innerHTML\s*=/.test(source), `${file} writes innerHTML`);
    }
  });

  test('an unsafe link keeps its characters as text instead of becoming navigable', () => {
    const content = '[click](javascript:alert(1))';
    const html = markupOf(React.createElement(MarkdownDocument, { content }));
    assert.ok(!html.includes('href="javascript:'), 'a javascript: destination became an attribute');
    assert.ok(textOfHtml(html).includes('[click](javascript:alert(1))'), 'the link lost its text');
  });
});

describe('the comparison itself can redden (controls)', () => {
  const served = '# Title\n\n| a | b |\n|---|---|\n| 1 | 2 |\n';

  test('the intact tree passes', () => {
    assert.equal(textMismatch(renderedText(served), served), '');
  });

  test('a dropped character fails it', () => {
    const blocks = parseBlocks(served);
    const cell = blocks.find((b) => b.type === 'table').rows[0][1][0];
    assert.equal(cell.value, '2');
    cell.value = '';
    assert.notEqual(textMismatch(textOfBlocks(blocks), served), '');
  });

  test('an invented character fails it', () => {
    const blocks = parseBlocks(served);
    const heading = blocks.find((b) => b.type === 'heading');
    assert.equal(heading.inline[0].value, 'Title');
    heading.inline[0].value += 'X';
    assert.notEqual(textMismatch(textOfBlocks(blocks), served), '');
  });
});

describe('direction is declared on the container that prints served text', () => {
  test('the document container carries dir="auto"', () => {
    const html = markupOf(React.createElement(MarkdownDocument, { content: '# x' }));
    assert.match(html, /^<div dir="auto"/, html.slice(0, 80));
  });

  test('a bilingual table cell resolves its own direction', () => {
    const html = markupOf(React.createElement(MarkdownDocument, {
      content: '| Field | \u0627\u0644\u062d\u0642\u0644 |\n|---|---|\n| a | \u0628 |\n',
    }));
    assert.match(html, /<th dir="auto"/, 'a header cell does not declare its direction');
    assert.match(html, /<td dir="auto"/, 'a body cell does not declare its direction');
  });
});
