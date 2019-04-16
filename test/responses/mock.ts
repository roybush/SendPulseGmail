'use strict';

import Api from '../../src/helpers/api';
const GET_TOKEN_RESPONSE = require('./get_token.json');
const  ACCESS_DENIED_RESPONSE = require('./access_denied_response.json');
import {API_URL} from '../../src/helpers/constants';
import {Method} from '../../src/model';

export class MockApi extends Api {
  __token__: string;
  __expires__: number;
  __clientId__: string;

  get token() {
    return this.__token__;
  }

  set token(token: string) {
    this.__token__ = token;
  }

  get expires() {
    return this.__expires__;
  }

  set expires(expires: number) {
    this.__expires__ = expires;
  }


  get clientId() {
    return this.__clientId__;
  }

  set clientId(clientId: string) {
    this.__clientId__ = clientId;
  }

}

export const CLIENT_ID = '690b81e7fbcbc8d355089702b7780d8f';
export const CLIENT_SECRET = 'd81a000350e70bf3ba9d7cd51171ac84';

export class XmlHttpRequestMock {

  headers: object = {};
  authUrl: string = API_URL + 'oauth/access_token';
  data: any;
  response: string;
  onload: Function;
  url: string;
  method: Method;
  status: number;

  send(data) {
    this.data = data ? JSON.parse(data) : null;
    this.response = JSON.stringify(this.getResponse());
    console.log(`Mocked ${this.method}: ${this.url}, headers: ${JSON.stringify(this.headers)}, \n request: ${data} \n response: ${this.response}`);
    // setTimeout(this.onreadystatechange, 10);
    this.onload();
  }

  getResponse() {
    if (this.headers['Authorization'] !== `${GET_TOKEN_RESPONSE.token_type} ${GET_TOKEN_RESPONSE.access_token}`) {
      this.status = 403;
      return ACCESS_DENIED_RESPONSE;
    } else {
      this.status = 200;
      return this.getMockedResponse();
    }
  }

  getMockedResponse() {
    throw 'overridden in child';
  }

  open(method, url) {
    this.url = url;
    this.method = method;
  }

  setRequestHeader(header, value) {
    this.headers[header] = value;
  }
}
