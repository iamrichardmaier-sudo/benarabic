import { describe, it, expect } from 'vitest';
import { friendlyAuthError } from './Auth';

describe('friendlyAuthError', () => {
  it('rewrites wrong credentials into plain language', () => {
    expect(friendlyAuthError({ message: 'Invalid login credentials' }, 'signIn')).toBe(
      "That email or password doesn't look right.",
    );
  });

  it('tells a duplicate signup to sign in instead', () => {
    expect(friendlyAuthError({ message: 'User already registered' }, 'signUp')).toBe(
      'You already have an account with that email — try signing in instead.',
    );
  });

  it('explains an unconfirmed email', () => {
    expect(friendlyAuthError({ message: 'Email not confirmed' }, 'signIn')).toBe(
      "This email hasn't been confirmed yet — check your inbox for the link we sent.",
    );
  });

  it('explains a rate limit by status code even without a matching message', () => {
    expect(friendlyAuthError({ message: 'Too Many Requests', status: 429 }, 'signIn')).toBe(
      "That's one too many tries — wait a minute and try again.",
    );
  });

  it('explains a rate limit by message when no status is present', () => {
    expect(
      friendlyAuthError(
        { message: 'For security purposes, you can only request this after 42 seconds.' },
        'forgot',
      ),
    ).toBe("That's one too many tries — wait a minute and try again.");
  });

  it('explains a network failure', () => {
    expect(friendlyAuthError({ message: 'Failed to fetch' }, 'signIn')).toBe(
      "Couldn't reach the server — check your connection and try again.",
    );
  });

  it('falls back to a generic message when there is no error message at all', () => {
    expect(friendlyAuthError(undefined, 'signUp')).toBe('Could not create your account. Please try again.');
    expect(friendlyAuthError({}, 'signIn')).toBe('Something went wrong. Please try again.');
  });

  it('passes an unrecognized message through unchanged, rather than hiding it', () => {
    expect(friendlyAuthError({ message: 'Some new GoTrue error we have not seen yet' }, 'signIn')).toBe(
      'Some new GoTrue error we have not seen yet',
    );
  });
});
