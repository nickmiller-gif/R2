import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className={[
        'prose prose-sm prose-invert max-w-none',
        'prose-p:leading-relaxed prose-p:my-2 prose-p:text-body prose-p:tracking-wide',
        'prose-headings:font-normal prose-headings:tracking-wide prose-headings:text-fg',
        'prose-a:text-accent prose-a:no-underline hover:prose-a:underline',
        'prose-code:rounded prose-code:border prose-code:border-border prose-code:bg-canvas prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-canvas prose-pre:border prose-pre:border-border prose-pre:rounded-[10px]',
        'prose-strong:text-fg prose-strong:font-medium',
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
