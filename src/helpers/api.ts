import {
  API_URL, FB_ACCESS_TOKEN, LS_CLIENT_ID, LS_TOKEN_EXPIRES,
  LS_TOKEN_NAME
} from './constants';
import serialize from './serializer';
import {TokenResponse, Response, Method, MailList, Mail, FBMeResponse, MailVars, MailInfoResponse} from '../model';

export default class Api {


  constructor(private XmlHttpRequest: any) {
  }

  get token(): string {
    return window.localStorage.getItem(LS_TOKEN_NAME) || '';
  }

  set token(token: string) {
    if (token) {
      window.localStorage.setItem(LS_TOKEN_NAME, token);
    } else {
      window.localStorage.removeItem(LS_TOKEN_NAME);
    }
  }

  getMyFBId(cb: Response<string>) {
    window['chrome'].runtime.sendMessage({facebook_c_user: true}, (response) => {
      if (response) {
        cb(response);
      } else {
        cb(null, `You should be logged in facebook, https://fb.com`);
      }
    });
  }

  fetchEmailData(id: number, email: string, cb: Response<MailVars>) {
    this._get<MailInfoResponse>(`addressbooks/${id}/emails/${encodeURIComponent(email)}`, (ok, err) => {
      let res: MailVars = {firstName: '', lastName: ''};
      if (ok && ok.message === 'Email not found') {
        cb(res, null);
      } else if (err) {
        cb(null, err);
      } else {
        if (ok && ok.variables && ok.variables.length > 0) {
          ok.variables.forEach(v => {
            if (v.name === 'firstName') {
              res.firstName = v.value || '';
            } else if (v.name === 'lastName') {
              res.lastName = v.value || '';
            }
          });
        }
        cb(res, null);
      }
    });
  }

  getUserInfoByEmail(email: string, cb: Response<MailVars>): void {
    this.getMyFBId((ok, err) => {
      if (ok) {
        let queryParams = {
          'dpr': '1.5',
          'value': email,
          'viewer': ok,
          '__a': '1',
          '__dyn': '',
        };

        this._submit<any>(
          Method.GET,
          `https://www.facebook.com/ajax/typeahead/search.php?${this._urlEncode(queryParams)}`,
          {}, {}, (ok, err) => {
            if (err) {
              cb(null, err);
            } else {
              if (ok.errorDescription || ok.errorSummary) {
                cb(null, `FB error, ${ok.errorSummary || ''}. ${ok.errorDescription || ''}`);
              } else {
                let l = ok && ok.payload && ok.payload.entries && ok.payload.entries.length;
                if (l === 0) {
                  cb(null, 'No matched');
                } else if (l > 1) {
                  cb(null, 'More than 1 match');
                } else if (l === 1) {
                   let k = ok.payload.entries[0];
                  cb({firstName: k.firstname, lastName: k.lastname} );
                } else {
                  cb(null, 'Invalid fb response');
                }
              }
            }
          }, r => r.substr(r.indexOf('{'))
        );
      } else {
        cb(null, err);
      }
    });
  }

  _urlEncode(obj) {
    let str = [];
    for (let p in obj)
      if (obj.hasOwnProperty(p)) {
        str.push(`${encodeURIComponent(p)}=${encodeURIComponent(obj[p])}`);
      }
    return str.join('&');
  }

  get clientId(): string {
    return window.localStorage.getItem(LS_CLIENT_ID) || '';
  }

  set clientId(clientId: string) {
    if (clientId) {
      window.localStorage.setItem(LS_CLIENT_ID, clientId);
    } else {
      window.localStorage.removeItem(LS_CLIENT_ID);
    }
  }

  get expires(): number {
    let te = window.localStorage.getItem(LS_TOKEN_EXPIRES);
    return te ? parseInt(te) : 0;
  }

  set expires(v) {
    if (v) {
      window.localStorage.setItem(LS_TOKEN_EXPIRES, String(v));
    } else {
      window.localStorage.removeItem(LS_TOKEN_EXPIRES);
    }
  }

  login(clientId: string, clientSecret: string, cb: Response<string>): void {
    this._submit<TokenResponse>(Method.POST, `${API_URL}oauth/access_token`, {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret
    }, {}, (ok, err) => {
      if (err) {
        cb(null, err);
      } else if (ok.token_type && ok.access_token && ok.expires_in) {
        this.token = `${ok.token_type} ${ok.access_token}`;
        this.clientId = clientId.substr(0, 8);
        this.expires = Date.now() + ok.expires_in * 1000;
        cb(this.token, null);
      } else {
        cb(null, 'Server didn\'t return auth tokens');
      }
    });
  }

  _post<T>(url: string, params: object, cb: Response<T>) {
    this._submitWithAuth(Method.POST, url, params, cb);
  }

  _get<T>(url: string, cb: Response<T>) {
    this._submitWithAuth(Method.GET, url, null, cb);
  }

  _submitWithAuth<T>(method: Method, url: string, data: object, callback: Response<T>) {
    if (!this.token || this.expires < Date.now()) {
      callback(null, 'Auth token doesn\'t exist or expired, login again');
    } else {
      this._submit<any>(method, API_URL + url, data, {'Authorization': this.token}, (ok, err) => {
        if (err && ok && ok.error === 'access_denied') {
          callback(null, 'Token has expired. Please login again');
        } else {
          callback(ok, err);
        }
      });
    }
  }


  _submit<T>(method: Method, url: string, data: object, headers: object, callback: Response<T>, responseExtractor = r => r) {
    let r = new this.XmlHttpRequest();
    r.onload = () => {
      let response;
      let parseError;
      try {
        response = JSON.parse(responseExtractor(r.response));
      } catch (e) {
        parseError = e;
      }
      if (parseError) {
        callback(null, `Can't parse response ${parseError}`);
      } else if (r.status === 200) {
        callback(response);
      } else {
        let description = response.message || r.response;
        callback(response, `Err status ${r.status}: ${description}`);
      }
    };
    r.onerror = () => {
      callback(null, 'Something wrong with connection');
    };
    r.open(method, url, true);
    headers['Content-type'] = 'application/json';
    for (let h in headers) {
      if (headers.hasOwnProperty(h)) {
        r.setRequestHeader(h, headers[h]);
      }
    }
    if (data) {
      let jsData;
      try {
        jsData = JSON.stringify(data);
      } catch (e) {
        callback(null, `Unable to serialize request data: ${e}`);
        return;
      }
      r.send(jsData);
    } else {
      r.send();
    }
  }


  addEmailsToList(listId: number, mails: Mail[], cb: Response<any>) {
    this._post(`addressbooks/${listId}/emails`, {
      emails: serialize(mails)
    }, cb);
  }

  getMailLists(cb: Response<MailList[]>) {
    this._get(`addressbooks`, cb);
  }

}
