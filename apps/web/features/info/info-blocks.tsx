import Link from 'next/link';

import type { Block, Inline } from '@repo/shared/info';

function Text({ parts }: { parts: Inline[] }): React.JSX.Element {
  return (
    <>
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : 'strong' in part ? (
          <strong key={i}>{part.strong}</strong>
        ) : part.to.startsWith('/') ? (
          <Link key={i} href={part.to} className="underline">
            {part.link}
          </Link>
        ) : (
          <a key={i} href={part.to} className="underline">
            {part.link}
          </a>
        ),
      )}
    </>
  );
}

/**
 * The info pages' blocks (@repo/shared/info, one source with the app, D-095) drawn as the website has always drawn
 * them: headings, paragraphs, lists and the FAQ's questions that open and close.
 */
export function InfoBlocks({ blocks }: { blocks: Block[] }): React.JSX.Element {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.kind === 'h')
          return (
            <h2 key={i} className="font-medium">
              {b.text}
            </h2>
          );
        if (b.kind === 'p')
          return (
            <p key={i} className={[b.muted ? 'text-ink-muted' : '', b.small ? 'text-sm' : ''].join(' ').trim() || undefined}>
              <Text parts={b.parts} />
            </p>
          );
        if (b.kind === 'ul' || b.kind === 'ol') {
          const List = b.kind;
          return (
            <List key={i} className={b.kind === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-2 pl-5'}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Text parts={item} />
                </li>
              ))}
            </List>
          );
        }
        const qa = b.kind === 'qa' ? b.items : [];
        return (
          <div key={i}>
            {qa.map((item) => (
              <details key={item.q} className="border-line border-b py-3">
                <summary className="font-ui min-h-11 cursor-pointer font-medium">{item.q}</summary>
                <div className="text-ink mt-2 space-y-2">
                  <InfoBlocks blocks={item.a} />
                </div>
              </details>
            ))}
          </div>
        );
      })}
    </>
  );
}
