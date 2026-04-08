import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className={[
        'prose prose-sm max-w-none dark:prose-invert',
        'prose-p:leading-relaxed prose-p:my-2',
        'prose-headings:font-display prose-headings:font-semibold prose-headings:tracking-tight',
        'prose-a:text-accent prose-a:no-underline hover:prose-a:underline',
        'prose-code:rounded prose-code:bg-elevated prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-elevated prose-pre:border prose-pre:border-border prose-pre:rounded-card',
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
