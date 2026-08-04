import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { steps } from '@/content/how-it-works';

import { ProcessSteps } from './process-steps';

describe('ProcessSteps', () => {
  it('renders every step', () => {
    render(<ProcessSteps steps={steps} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(steps.length);
  });

  it('uses an ordered list, because the order is the meaning', () => {
    const { container } = render(<ProcessSteps steps={steps} />);

    expect(container.querySelector('ol')).toBeInTheDocument();
  });

  it('keeps the steps in the order they were given', () => {
    render(<ProcessSteps steps={steps} />);

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings).toEqual(steps.map((step) => step.title));
  });

  it('shows each step’s title and body', () => {
    render(<ProcessSteps steps={steps} />);

    const items = screen.getAllByRole('listitem');

    steps.forEach((step, index) => {
      expect(within(items[index]).getByRole('heading', { name: step.title })).toBeInTheDocument();
      expect(within(items[index]).getByText(step.body)).toBeInTheDocument();
    });
  });

  it('shows the printed numbers but hides them from assistive tech', () => {
    // The ordered list already conveys sequence; announcing "01 Sign Up" would
    // make a screen reader say the position twice.
    render(<ProcessSteps steps={steps} />);

    for (const step of steps) {
      expect(screen.getByText(step.number)).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders nothing but an empty list when given no steps', () => {
    render(<ProcessSteps steps={[]} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
