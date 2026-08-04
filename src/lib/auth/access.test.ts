import { describe, expect, it } from 'vitest';

import { applyAccessRules, roleFromSession } from './access';

const origin = 'http://localhost:3000';

function locationOf(response: Response): string | null {
  const location = response.headers.get('location');
  return location ? new URL(location).pathname + new URL(location).search : null;
}

describe('roleFromSession', () => {
  it('reads a valid role off the session user', () => {
    expect(roleFromSession({ user: { role: 'ARTIST' } })).toBe('ARTIST');
    expect(roleFromSession({ user: { role: 'COLLECTOR' } })).toBe('COLLECTOR');
    expect(roleFromSession({ user: { role: 'ADMIN' } })).toBe('ADMIN');
  });

  it('returns null when there is no session', () => {
    expect(roleFromSession(null)).toBeNull();
    expect(roleFromSession(undefined)).toBeNull();
  });

  it('returns null for a session carrying an unknown or missing role', () => {
    expect(roleFromSession({ user: {} })).toBeNull();
    expect(roleFromSession({ user: { role: 'SUPERUSER' } })).toBeNull();
    expect(roleFromSession({})).toBeNull();
  });
});

describe('applyAccessRules', () => {
  it('passes a public route straight through', () => {
    const response = applyAccessRules(new URL(`${origin}/browse`), null);
    expect(response.status).toBe(200);
    expect(locationOf(response)).toBeNull();
  });

  it('redirects an anonymous visitor to login, preserving where they were headed', () => {
    const response = applyAccessRules(new URL(`${origin}/artist/dashboard`), null);
    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe('/login?callbackUrl=%2Fartist%2Fdashboard');
  });

  it.each([
    ['/artist/dashboard', 'ARTIST'],
    ['/collector/favourites', 'COLLECTOR'],
    ['/admin', 'ADMIN'],
  ] as const)('lets %s through for %s', (pathname, role) => {
    const response = applyAccessRules(new URL(`${origin}${pathname}`), role);
    expect(response.status).toBe(200);
  });

  it.each([
    ['/artist/dashboard', 'COLLECTOR'],
    ['/artist/dashboard', 'ADMIN'],
    ['/collector/favourites', 'ARTIST'],
    ['/collector/favourites', 'ADMIN'],
    ['/admin', 'ARTIST'],
    ['/admin', 'COLLECTOR'],
  ] as const)('sends %s to /forbidden for %s', (pathname, role) => {
    const response = applyAccessRules(new URL(`${origin}${pathname}`), role);
    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe('/forbidden');
  });

  it('keeps redirects on the same origin', () => {
    const response = applyAccessRules(new URL(`${origin}/admin`), 'ARTIST');
    expect(response.headers.get('location')).toBe(`${origin}/forbidden`);
  });
});
