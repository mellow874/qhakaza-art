import { describe, expect, it } from 'vitest';

import { authorize, isPublicPath, requiredRoleForPath } from './rbac';

describe('requiredRoleForPath', () => {
  it('fences the artist area to ARTIST', () => {
    expect(requiredRoleForPath('/artist')).toBe('ARTIST');
    expect(requiredRoleForPath('/artist/listings/new')).toBe('ARTIST');
  });

  it('fences the collector area to COLLECTOR', () => {
    expect(requiredRoleForPath('/collector')).toBe('COLLECTOR');
    expect(requiredRoleForPath('/collector/favourites')).toBe('COLLECTOR');
  });

  it('fences the admin area to ADMIN', () => {
    expect(requiredRoleForPath('/admin')).toBe('ADMIN');
    expect(requiredRoleForPath('/admin/orders/ord_1')).toBe('ADMIN');
  });

  it('returns null for public paths', () => {
    expect(requiredRoleForPath('/')).toBeNull();
    expect(requiredRoleForPath('/browse')).toBeNull();
    expect(requiredRoleForPath('/art/piece-1')).toBeNull();
    expect(requiredRoleForPath('/artists/thandi-m')).toBeNull();
  });

  it('does not treat a lookalike prefix as a protected area', () => {
    // `/artists` is the public storefront index — it must not be fenced as `/artist`.
    expect(requiredRoleForPath('/artists')).toBeNull();
    expect(requiredRoleForPath('/administrators')).toBeNull();
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
