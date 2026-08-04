import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const usePathname = vi.hoisted(() => vi.fn(() => '/'));
vi.mock('next/navigation', () => ({ usePathname }));

const { SiteHeader } = await import('./site-header');

describe('SiteHeader — signed out', () => {
  it('shows the wordmark linking home', () => {
    render(<SiteHeader session={null} />);

    expect(screen.getByRole('link', { name: /qhakaza art collective/i })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('offers every main destination', () => {
    render(<SiteHeader session={null} />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const [label, href] of [
      ['Home', '/'],
      ['About', '/about'],
      ['How it works', '/how-it-works'],
      ['Features', '/features'],
      ['Briefings', '/briefings'],
      ['FAQ', '/faq'],
    ]) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it('offers both sign-in and the suite call to action', () => {
    render(<SiteHeader session={null} />);

    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login');
    expect(screen.getAllByRole('link', { name: 'Enter the suite' })[0]).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('does not show an account link', () => {
    render(<SiteHeader session={null} />);

    expect(screen.queryByRole('link', { name: /dashboard|favourites/i })).not.toBeInTheDocument();
  });
});

describe('SiteHeader — current page', () => {
  it('marks the active destination for assistive tech', () => {
    usePathname.mockReturnValue('/about');
    render(<SiteHeader session={null} />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('does not mark home as current on every page', () => {
    // `/` is a prefix of everything, so it needs an exact match, not startsWith.
    usePathname.mockReturnValue('/briefings');
    render(<SiteHeader session={null} />);

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Briefings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('SiteHeader — signed in', () => {
  it.each([
    ['ARTIST', /dashboard/i, '/artist/dashboard'],
    ['COLLECTOR', /favourites/i, '/collector/favourites'],
    ['ADMIN', /admin/i, '/admin'],
  ] as const)('sends a %s to their own area', (role, name, href) => {
    usePathname.mockReturnValue('/');
    render(<SiteHeader session={{ user: { name: 'Someone', role } }} />);

    expect(screen.getAllByRole('link', { name })[0]).toHaveAttribute('href', href);
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

describe('SiteHeader — mobile menu', () => {
  it('starts closed', () => {
    render(<SiteHeader session={null} />);

    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('opens and closes on the toggle', async () => {
    const user = userEvent.setup();
    render(<SiteHeader session={null} />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /close menu/i }));
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('controls the element it names', async () => {
    const user = userEvent.setup();
    render(<SiteHeader session={null} />);

    const toggle = screen.getByRole('button', { name: /open menu/i });
    await user.click(toggle);

    const controlledId = toggle.getAttribute('aria-controls');
    expect(controlledId).toBeTruthy();
    expect(document.getElementById(controlledId!)).toBeInTheDocument();
  });
});
