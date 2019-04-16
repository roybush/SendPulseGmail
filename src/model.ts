export enum Method {
  POST = 'POST', GET = 'GET'
}

export enum Page {
  ADD = 'add', LOGIN = 'login', NONE = 'none'
}

export declare type Response<T> = (ok: T, error?: string) => void;

export declare type TokenResponse = {
  'access_token': string,
  'token_type': string,
  'expires_in': number
};

export declare type FBMeResponse = {
  'id': string,
  'name': string,
};

export declare interface MailList {
  id: number;
  name: string;
}

export declare type MailVars = {
  firstName: string;
  lastName: string;
};

export declare type Mail = {
  email: string,
  variables: MailVars;
};

export declare type Variable = {
  name: string;
  type: string;
  value: string;
};

export declare type MailInfoResponse = {
  email: string;
  message: string; // if error instead of response
  variables: Variable[];
};
