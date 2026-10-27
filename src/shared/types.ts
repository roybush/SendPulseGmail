import type { FieldMapping } from './fields';

/**
 * Two ways SendPulse lets you into its API:
 * a permanent API key (sp_apikey_…), or a client ID + secret exchanged for a 1-hour token.
 */
export type Credentials =
  { kind: 'apiKey'; apiKey: string } | { kind: 'oauth'; clientId: string; clientSecret: string };

export type AuthStatus =
  | { loggedIn: false }
  | { loggedIn: true; method: Credentials['kind']; /** Masked key or client ID. */ label: string };

export type AddressBook = {
  id: number;
  name: string;
  totalEmails: number;
  activeEmails: number;
};

export type BookVariable = {
  name: string;
  type: string;
};

/** A contact's presence in one address book. */
export type Membership = {
  bookId: number;
  status: string;
  variables: Record<string, string>;
};

/** Small UI preferences, kept by the service worker. */
export type Prefs = {
  lastBookId?: number;
  /** Per address book (by id): which variable receives which profile field. */
  mappings?: Record<string, FieldMapping>;
};

export type NewContact = {
  email: string;
  variables?: Record<string, string>;
};
