import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { FaqAccordion } from './faq-accordion';

const items = [
  { question: 'Who can join the platform?', answer: 'Any artist may subscribe.' },
  { question: 'What does it cost?', answer: 'Pricing is published on the sign-up page.' },
  { question: 'How is my work verified?', answer: 'Through documentation you attach yourself.' },
];

describe('FaqAccordion', () => {
  it('lists every question', () => {
    render(<FaqAccordion items={items} />);

    for (const item of items) {
      expect(screen.getByRole('button', { name: new RegExp(item.question) })).toBeInTheDocument();
    }
  });

  it('starts with every answer collapsed', () => {
    render(<FaqAccordion items={items} />);

    for (const item of items) {
      expect(screen.getByRole('button', { name: new RegExp(item.question) })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    }
    expect(screen.queryByText(items[0].answer)).not.toBeVisible();
  });

  it('opens an answer when its question is activated', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={items} />);

    await user.click(screen.getByRole('button', { name: new RegExp(items[0].question) }));

    expect(screen.getByRole('button', { name: new RegExp(items[0].question) })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText(items[0].answer)).toBeVisible();
  });

  it('closes again when the same question is activated twice', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={items} />);

    const question = screen.getByRole('button', { name: new RegExp(items[0].question) });
    await user.click(question);
    await user.click(question);

    expect(question).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens one answer at a time', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={items} />);

    await user.click(screen.getByRole('button', { name: new RegExp(items[0].question) }));
    await user.click(screen.getByRole('button', { name: new RegExp(items[1].question) }));

    expect(screen.getByRole('button', { name: new RegExp(items[0].question) })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: new RegExp(items[1].question) })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('is operable by keyboard', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={items} />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: new RegExp(items[0].question) })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('points each question at the panel it controls', async () => {
    const user = userEvent.setup();
    render(<FaqAccordion items={items} />);

    const question = screen.getByRole('button', { name: new RegExp(items[0].question) });
    await user.click(question);

    const panelId = question.getAttribute('aria-controls');
    expect(panelId).toBeTruthy();
    expect(document.getElementById(panelId!)).toHaveTextContent(items[0].answer);
  });

  it('renders an empty list rather than throwing when there are no questions', () => {
    render(<FaqAccordion items={[]} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
