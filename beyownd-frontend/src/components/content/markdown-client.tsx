"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";

/*
 * Client copy of <Markdown> for the app (live previews, briefs). Same safety:
 * rehype-sanitize runs before highlighting; never dangerouslySetInnerHTML.
 */
export function MarkdownClient({ children }: { children: string }) {
  return (
    <div className="prose-lesson">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
