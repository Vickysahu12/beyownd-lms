import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";

/*
 * Lesson content is Markdown from the API. Rendered with react-markdown and
 * sanitised (rehype-sanitize) BEFORE highlighting adds its classes. Never
 * dangerouslySetInnerHTML (BRIEF §10.1). Server component: no client JS.
 */
/** Drops a leading "# Title" when the page already shows the title as its <h1>. */
export function stripLeadingTitle(md: string, title: string) {
  const m = md.match(/^\s*#\s+(.+)\n+/);
  return m && m[1].trim().toLowerCase() === title.trim().toLowerCase() ? md.slice(m[0].length) : md;
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-lesson">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
              {c}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
