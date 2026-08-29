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
};

/**
 * Renders AVA assistant message content as GitHub-flavored Markdown with
 * KaTeX math support (`$...$` inline and `$$...$$` block).
 *
 * Used for the final, fully-streamed assistant response. While the typewriter
 * is still streaming partial content, the page renders plain text instead to
 * avoid broken/incomplete markdown syntax flickering on screen.
 */
function AvaMarkdownImpl({ content }: { content: string }) {
  return (
    <div className="ava-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const AvaMarkdown = memo(AvaMarkdownImpl);
export default AvaMarkdown;
