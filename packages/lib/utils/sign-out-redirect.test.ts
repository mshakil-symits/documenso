import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveSignOutRedirect } from './sign-out-redirect';

describe('resolveSignOutRedirect', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps an explicit redirect path', () => {
    vi.stubEnv('NEXT_PUBLIC_POST_SIGNOUT_URL', 'https://sso.example.test/logout');

    expect(resolveSignOutRedirect('/somewhere')).toBe('/somewhere');
  });

  it('goes to the configured post sign-out URL when there is no explicit path', () => {
    vi.stubEnv('NEXT_PUBLIC_POST_SIGNOUT_URL', 'https://sso.example.test/logout');

    expect(resolveSignOutRedirect()).toBe('https://sso.example.test/logout');
  });

  it('falls back to the sign-in page when unset or empty', () => {
    vi.stubEnv('NEXT_PUBLIC_POST_SIGNOUT_URL', '');

    expect(resolveSignOutRedirect()).toBe('/signin');
  });

  it('ignores a value that is not an http(s) URL', () => {
    vi.stubEnv('NEXT_PUBLIC_POST_SIGNOUT_URL', 'javascript:alert(1)');

    expect(resolveSignOutRedirect()).toBe('/signin');
  });
});
