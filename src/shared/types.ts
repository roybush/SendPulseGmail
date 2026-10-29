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

/** Campaign history of one address across the account. */
export type ContactStats = {
  sent: number;
  opened: number;
  clicked: number;
  blacklisted: boolean;
};

export type CrmPipeline = {
  id: number;
  name: string;
  steps: { id: number; name: string }[];
};

/** What the CRM needs to create a contact. */
export type CrmContactInput = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

export type NewDeal = {
  pipelineId: number;
  stepId: number;
  name: string;
  /** SendPulse links at most 5 contacts to a deal. */
  contacts: CrmContactInput[];
};

/** A verified "From" address in SendPulse, needed for confirmation emails. */
export type Sender = { name: string; email: string };

/** Double opt-in: SendPulse emails each new contact a confirmation link first. */
export type OptIn = {
  senderEmail: string;
  /** Language of SendPulse's default confirmation email. */
  lang: string;
};

/** Small UI preferences, kept by the service worker. */
export type Prefs = {
  lastBookId?: number;
  lastPipelineId?: number;
  /** Sender of confirmation emails; set = double opt-in is on. */
  optInSender?: string;
  /** Per address book (by id): which variable receives which profile field. */
  mappings?: Record<string, FieldMapping>;
};

export type NewContact = {
  email: string;
  variables?: Record<string, string>;
};
