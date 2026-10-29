/**
 * Blocks from `markdown.js` -> React ELEMENTS. No `dangerouslySetInnerHTML`, no markup strings.
 *
 * The typography is here rather than in App.tsx on purpose: the previous wrapper was
 * `prose prose-slate`, which emits NO CSS in this project (`@tailwindcss/typography` is not a
 * dependency), so the classes said nothing about what a reader saw. These are plain Tailwind
 * utilities, which is why `src/markdownView.js` must be named in `src/index.css`'s `@source` list —
 * `src/tailwindSources.test.js` reddens if a class-carrying file is missing from it.
 *
 * DIRECTION (a declaration, not a layout): the served documents are bilingual — every table row is
 * "English / Arabic" — so the container that prints served text carries `dir="auto"`, and so does
 * each table cell, so a cell whose text is Arabic renders right-to-left inside an LTR page. That is
 * the whole of the direction work here. Nothing is mirrored, there are no Arabic strings, no
 * language state and no switch; `dir="auto"` on one container is not evidence that an RTL layout
 * works.
 */
import React from 'react';
import { parseBlocks, isRenderableHref } from './markdown.js';

const ROOT = 'text-sm text-slate-700';
const HEADINGS = {
  1: 'text-2xl font-bold text-slate-900 mt-8 mb-3 first:mt-0',
  2: 'text-xl font-bold text-slate-900 mt-7 mb-3',
  3: 'text-base font-bold text-slate-900 uppercase tracking-wide mt-6 mb-2',
  4: 'text-sm font-bold text-slate-900 mt-5 mb-2',
  5: 'text-sm font-bold text-slate-800 mt-4 mb-2',
  6: 'text-sm font-semibold text-slate-800 mt-4 mb-2',
};

function renderSegment(segment, key) {
  switch (segment.type) {
    case 'strong':
      return React.createElement('strong', { key, className: 'font-bold text-slate-900' }, segment.value);
    case 'code':
      return React.createElement(
        'code',
        { key, className: 'font-mono text-[11px] bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-slate-800' },
        segment.value,
      );
    case 'link':
      return isRenderableHref(segment.href)
        ? React.createElement(
          'a',
          { key, href: segment.href, target: '_blank', rel: 'noreferrer noopener', className: 'text-teal-700 underline' },
          segment.text,
        )
        // A destination the product will not navigate to is shown as its own source text, so the
        // reader still sees every character the document carried.
        : React.createElement('span', { key }, `[${segment.text}](${segment.href})`);
    default:
      return segment.value;
  }
}

function renderLine(segments, key) {
  return React.createElement(
    'div',
    { key },
    (segments || []).map((s, i) => renderSegment(s, i)),
  );
}

function renderBlock(block, key) {
  switch (block.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, block.level || 1));
      return React.createElement(
        `h${level}`,
        { key, className: HEADINGS[level] },
        (block.inline || []).map((s, i) => renderSegment(s, i)),
      );
    }
    case 'paragraph':
      return React.createElement(
        'p',
        { key, className: 'mb-3 leading-relaxed' },
        (block.inline || []).map((s, i) => renderSegment(s, i)),
      );
    case 'quote':
      return React.createElement(
        'blockquote',
        { key, className: 'border-l-4 border-slate-200 pl-4 my-4 space-y-1 text-slate-600' },
        (block.lines || []).map((line, i) => renderLine(line, i)),
      );
    case 'list':
      return React.createElement(
        'ul',
        { key, className: 'list-disc pl-6 mb-3 space-y-1' },
        (block.items || []).map((item, i) => React.createElement(
          'li',
          { key: i },
          item.map((s, j) => renderSegment(s, j)),
        )),
      );
    case 'table':
      return React.createElement(
        'table',
        { key, className: 'w-full border-collapse my-4 text-[13px]' },
        React.createElement(
          'thead',
          null,
          React.createElement(
            'tr',
            null,
            (block.header || []).map((cell, i) => React.createElement(
              'th',
              { key: i, dir: 'auto', className: 'border border-slate-200 bg-slate-50 p-2 text-left align-top font-bold text-slate-900' },
              cell.map((s, j) => renderSegment(s, j)),
            )),
          ),
        ),
        React.createElement(
          'tbody',
          null,
          (block.rows || []).map((row, r) => React.createElement(
            'tr',
            { key: r },
            row.map((cell, i) => React.createElement(
              'td',
              { key: i, dir: 'auto', className: 'border border-slate-200 p-2 align-top' },
              cell.map((s, j) => renderSegment(s, j)),
            )),
          )),
        ),
      );
    case 'codeblock':
      return React.createElement(
        'pre',
        { key, className: 'font-mono text-[11px] bg-slate-50 border border-slate-200 rounded p-4 my-4 overflow-x-auto whitespace-pre-wrap' },
        (block.lines || []).join('\n'),
      );
    case 'rule':
      return React.createElement('hr', { key, className: 'my-6 border-slate-200' });
    default:
      return null;
  }
}

/** Blocks -> React children. Exported so the rendered text can be asserted without a browser. */
export function renderBlocks(blocks) {
  return (blocks || []).map((block, i) => renderBlock(block, i));
}

/**
 * The container used by the document preview. `dir="auto"` lives here, on the element that prints
 * the served text, rather than on the page.
 */
export function MarkdownDocument({ content }) {
  return React.createElement(
    'div',
    { dir: 'auto', className: ROOT },
    renderBlocks(parseBlocks(content)),
  );
}
