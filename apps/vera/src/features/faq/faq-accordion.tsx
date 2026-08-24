'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

/**
 * Shaped by what the caller has, not by where it came from. The FAQ moved
 * from a TypeScript file to the database; the component did not need to care.
 */
type FaqItem = { question: string; answer: string };
import { cn } from '@qhakaza/shared-ui';

/**
 * Expandable question list.
 *
 * Built on a real `<button>` per question with `aria-expanded` and
 * `aria-controls`, so it is operable by keyboard and announced correctly —
 * rather than a div that only responds to a click.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <ul className="border-line/60 flex flex-col border-t">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;

        return (
          <li key={item.question} className="border-line/60 border-b">
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="text-heading hover:text-accent flex w-full items-center justify-between gap-6 py-7 text-left text-lg transition-colors sm:text-xl"
              >
                {item.question}
                <ChevronDown
                  aria-hidden="true"
                  strokeWidth={1.25}
                  className={cn(
                    'text-accent h-5 w-5 shrink-0 transition-transform duration-300',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
            </h3>

            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>
              <p className="text-body max-w-3xl pb-8 leading-relaxed">{item.answer}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
