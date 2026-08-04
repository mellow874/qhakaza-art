import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { sxScore, platformPreview } from '@/content/home';

import { PlatformPreviewPanel } from './platform-preview-panel';
import { SxScorePanel } from './sx-score-panel';

describe('SxScorePanel', () => {
  it('lists every metric with its code and value', () => {
    render(<SxScorePanel />);

    for (const metric of sxScore.metrics) {
      expect(screen.getByText(metric.code)).toBeInTheDocument();
      expect(screen.getByRole('meter', { name: new RegExp(metric.code) })).toBeInTheDocument();
    }
  });

  it('exposes each score to assistive tech rather than only as a bar width', () => {
    render(<SxScorePanel />);

    const cam = screen.getByRole('meter', { name: /CAM/ });
    expect(cam).toHaveAttribute('aria-valuenow', '72');
    expect(cam).toHaveAttribute('aria-valuemin', '0');
    expect(cam).toHaveAttribute('aria-valuemax', '100');
  });

  it('names each metric in full, not just by its abbreviation', () => {
    render(<SxScorePanel />);

    expect(screen.getByRole('meter', { name: /documentation strength/i })).toBeInTheDocument();
  });

  it('shows the overall score and its band', () => {
    render(<SxScorePanel />);

    expect(screen.getByText('54')).toBeInTheDocument();
    expect(screen.getByText(/100 · Emerging Asset/)).toBeInTheDocument();
  });
});

describe('PlatformPreviewPanel', () => {
  it('is labelled as an example, not presented as live data', () => {
    render(<PlatformPreviewPanel />);

    expect(screen.getByLabelText(/example artist record/i)).toBeInTheDocument();
  });

  it('shows the sample artist and their detail line', () => {
    render(<PlatformPreviewPanel />);

    expect(screen.getByText(platformPreview.sample.artist.name)).toBeInTheDocument();
    expect(screen.getByText(platformPreview.sample.artist.detail)).toBeInTheDocument();
  });

  it('lists each work with its reference, score and status', () => {
    render(<PlatformPreviewPanel />);

    const panel = screen.getByLabelText(/example artist record/i);

    for (const work of platformPreview.sample.works) {
      expect(within(panel).getByText(work.title)).toBeInTheDocument();
      expect(within(panel).getByText(work.reference)).toBeInTheDocument();
      expect(within(panel).getByText(`${work.score}%`)).toBeInTheDocument();
      expect(within(panel).getByText(work.status)).toBeInTheDocument();
    }
  });
});
