"use client";

import { memo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

// react-markdown passes a `node` (hast) prop to custom components which must be
// stripped before spreading onto a DOM element. This helper drops it safely.
function withoutNode<T>(props: T): Omit<T, "node"> {
  const { node: _node, ...rest } = props as Record<string, unknown>;
  void _node;
  return rest as Omit<T, "node">;
}

const components: Components = {
  a: (props) => <a {...withoutNode(props)} target="_blank" rel="noopener noreferrer" />,
  // Wrap tables so wide ones scroll horizontally instead of overflowing the chat bubble.
  table: (props) => (
    <div className="ava-markdown-table-wrap">
      <table {...withoutNode(props)} />
    </div>
  ),
};

const isPipeRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isDelimiterRow = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

/**
 * LLM output frequently emits GFM tables in ways remark-gfm cannot parse:
 * - escaped `\n` sequences instead of real newlines (from JSON persistence)
 * - no blank line between preceding text and the table header row (a GFM
 *   table cannot interrupt a paragraph, so the pipes render as plain text)
 * This normalizes both so tables render as actual tables.
 */
function normalizeMarkdownTables(content: string): string {
  let text = content.replace(/\r\n/g, "\n");
  if (text.includes("\\n") && !text.includes("\n")) {
    text = text.replace(/\\n/g, "\n");
  }

  const lines = text.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = out[out.length - 1];
    const next = lines[i + 1] ?? "";
    if (isPipeRow(line) && isDelimiterRow(next) && prev !== undefined && prev.trim() !== "" && !isPipeRow(prev)) {
      out.push("");
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Renders AVA assistant message content as GitHub-flavored Markdown with
 * KaTeX math support (`$$...$$` block only).
 *
 * Single-dollar inline math is intentionally disabled: AVA answers are full of
 * currency values ("Budgeted: $600, Actual: $0"), and remark-math would treat
 * the text between two `$` signs as a KaTeX formula, garbling the output.
 *
 * Used for the final, fully-streamed assistant response. While the typewriter
 * is still streaming partial content, the page renders plain text instead to
 * avoid broken/incomplete markdown syntax flickering on screen.
 */
function AvaMarkdownImpl({ content }: { content: string }) {
  return (
    <div className="ava-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {normalizeMarkdownTables(content)}
      </ReactMarkdown>
    </div>
  );
}

const AvaMarkdown = memo(AvaMarkdownImpl);
export default AvaMarkdown;
