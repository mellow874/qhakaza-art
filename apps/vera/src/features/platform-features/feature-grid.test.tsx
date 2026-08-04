import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { features } from '@/content/features';

import { FeatureGrid } from './feature-grid';

describe('FeatureGrid', () => {
  it('renders every feature', () => {
    render(<FeatureGrid features={features} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(features.length);
  });

  it('gives each feature a heading and its description', () => {
    render(<FeatureGrid features={features} />);

    const items = screen.getAllByRole('listitem');

    features.forEach((feature, index) => {
      expect(
        within(items[index]).getByRole('heading', { name: feature.title }),
      ).toBeInTheDocument();
      expect(within(items[index]).getByText(feature.body)).toBeInTheDocument();
    });
  });

  it('groups them as a list, so the count is announced', () => {
    render(<FeatureGrid features={features} />);

    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('hides the icons from assistive tech', () => {
    // Each icon duplicates the heading beside it; announcing it adds nothing.
    const { container } = render(<FeatureGrid features={features} />);

    const icons = container.querySelectorAll('svg');
    expect(icons).toHaveLength(features.length);
    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('renders an empty list rather than throwing when given nothing', () => {
    render(<FeatureGrid features={[]} />);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
