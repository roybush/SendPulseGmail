export type Credentials = {
  clientId: string;
  clientSecret: string;
};

export type AuthStatus = { loggedIn: false } | { loggedIn: true; clientIdPrefix: string };

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
};

export type NewContact = {
  email: string;
  variables?: Record<string, string>;
};
