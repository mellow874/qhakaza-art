import { describe, expect, it } from 'vitest';

import { authorize, isPublicPath, requiredRolesForPath } from './rbac';

describe('requiredRolesForPath', () => {
  it('fences the artist area to ARTIST', () => {
    expect(requiredRolesForPath('/artist')).toEqual(['ARTIST']);
    expect(requiredRolesForPath('/artist/listings/new')).toEqual(['ARTIST']);
  });

  it('fences the collector area to COLLECTOR', () => {
    expect(requiredRolesForPath('/collector')).toEqual(['COLLECTOR']);
    expect(requiredRolesForPath('/collector/favourites')).toEqual(['COLLECTOR']);
  });

  it('admits both Command Center roles to the admin area', () => {
    // ADVISOR joined ADMIN here in Phase 1: advisors run matching and concierge
    // work inside the Command Center without being platform administrators.
    expect(requiredRolesForPath('/admin')).toEqual(['ADMIN', 'ADVISOR']);
    expect(requiredRolesForPath('/admin/orders/ord_1')).toEqual(['ADMIN', 'ADVISOR']);
  });

  it('leaves /private to the Collector Platform, not the edge proxy', () => {
    /*
     * Not an oversight. Fencing /private here would bounce anonymous requests
     * to /login before anything could record them — and anonymous requests are
     * exactly what token guessing looks like. The private layout validates the
     * token and the role together, and writes an ActivationAttempt either way.
     */
    expect(requiredRolesForPath('/private/abc123')).toBeNull();
  });

  it('returns null for public paths', () => {
    expect(requiredRolesForPath('/')).toBeNull();
    expect(requiredRolesForPath('/browse')).toBeNull();
    expect(requiredRolesForPath('/art/piece-1')).toBeNull();
    expect(requiredRolesForPath('/artists/thandi-m')).toBeNull();
  });

  it('does not treat a lookalike prefix as a protected area', () => {
    // `/artists` is the public storefront index — it must not be fenced as `/artist`.
    expect(requiredRolesForPath('/artists')).toBeNull();
    expect(requiredRolesForPath('/administrators')).toBeNull();
  });
});

describe('isPublicPath', () => {
  it('marks marketing, browse, detail and storefront routes public', () => {
    for (const path of [
      '/',
      '/browse',
      '/art/abc',
      '/artists',
      '/artists/thandi-m',
      '/login',
      '/signup',
    ]) {
      expect(isPublicPath(path)).toBe(true);
    }
  });

  it('marks role areas non-public', () => {
    for (const path of ['/artist', '/collector', '/admin']) {
      expect(isPublicPath(path)).toBe(false);
    }
  });
});

describe('authorize', () => {
  it('allows anyone through a public route', () => {
    expect(authorize({ pathname: '/browse', role: null })).toEqual({ allowed: true });
    expect(authorize({ pathname: '/browse', role: 'ARTIST' })).toEqual({ allowed: true });
  });

  it('sends an unauthenticated visitor to login with a callback back to where they were going', () => {
    expect(authorize({ pathname: '/collector/favourites', role: null })).toEqual({
      allowed: false,
      redirectTo: '/login?callbackUrl=%2Fcollector%2Ffavourites',
    });
  });

  it('lets each role into its own area', () => {
    expect(authorize({ pathname: '/artist/dashboard', role: 'ARTIST' })).toEqual({ allowed: true });
    expect(authorize({ pathname: '/collector/orders', role: 'COLLECTOR' })).toEqual({
      allowed: true,
    });
    expect(authorize({ pathname: '/admin', role: 'ADMIN' })).toEqual({ allowed: true });
  });

  it('forbids a COLLECTOR from artist routes', () => {
    expect(authorize({ pathname: '/artist/dashboard', role: 'COLLECTOR' })).toEqual({
      allowed: false,
      redirectTo: '/forbidden',
    });
  });

  it('forbids an ARTIST from collector and admin routes', () => {
    expect(authorize({ pathname: '/collector/orders', role: 'ARTIST' })).toEqual({
      allowed: false,
      redirectTo: '/forbidden',
    });
    expect(authorize({ pathname: '/admin', role: 'ARTIST' })).toEqual({
      allowed: false,
      redirectTo: '/forbidden',
    });
  });

  it('does not give ADMIN a free pass into artist or collector areas', () => {
    // Admins oversee via /admin. They do not impersonate other roles' areas.
    expect(authorize({ pathname: '/artist/dashboard', role: 'ADMIN' })).toEqual({
      allowed: false,
      redirectTo: '/forbidden',
    });
    expect(authorize({ pathname: '/collector/orders', role: 'ADMIN' })).toEqual({
      allowed: false,
      redirectTo: '/forbidden',
    });
  });
});
