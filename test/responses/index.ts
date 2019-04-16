'use strict';

import {assert, expect} from 'chai';
const GET_TOKEN_RESPONSE = require('./get_token.json');
const GET_EMAIL_INFO_RESPONSE =  require('./get_email_info.json');
const AUTH_ERROR =  require('./auth_error.json');
const GET_EMAIL_NO_ID =  require('./get_email_no_id.json');
const GET_EMAIL_NO_RES_ERR = require('./get_email_no_res_err.json');
const GET_MAIL_LISTS = require('./get_mail_lists.json');
const GET_TOKEN_ERR_RESPONSE = require('./get_token_error.json');
import {CLIENT_ID, CLIENT_SECRET, MockApi, XmlHttpRequestMock} from './mock';

describe('Api', () => {
  let validToken = `${GET_TOKEN_RESPONSE.token_type} ${GET_TOKEN_RESPONSE.access_token}`;
  describe('login', () => {
    class LoginRequest extends XmlHttpRequestMock {
      getResponse() {
        if (this.data.client_id === CLIENT_ID && this.data.client_secret === CLIENT_SECRET) {
          this.status = 200;
          return GET_TOKEN_RESPONSE;
        } else {
          this.status = 401;
          return GET_TOKEN_ERR_RESPONSE;
        }
      }
    }
    it('success', done => {
      const api = new MockApi(LoginRequest);
      api.login(CLIENT_ID, CLIENT_SECRET,(token, err) => {
       assert.equal(validToken, token);
        assert.isNotOk(err);
        done();
      });
    });
    it('fail wrong secret', done => {
      const api = new MockApi(LoginRequest);
      api.login(CLIENT_ID, 'invalid_secret', (token, err) => {
        assert.include(err, 'Client authentication failed');
        done();
      });
    });
  });
  describe('fetchEmailData', () => {
    it('success existing valid token', done => {
      class GetEmail extends XmlHttpRequestMock {
        getMockedResponse() {
          return GET_EMAIL_INFO_RESPONSE;
        }
      }
      const api = new MockApi(GetEmail);
      api.token = validToken;
      let email = 'deathangel908@gmail.com';
      api.fetchEmailData(1, email, (ok, err) => {
        assert.isNotOk(err);
        assert.deepEqual(ok, {firstName: 'firstNameValue', lastName: 'lastNameValue'});
        done();
      });
    });
    it('auth error', done => {
      class GetEmailAuthErr extends XmlHttpRequestMock {
        getMockedResponse() {
          return AUTH_ERROR;
        }
      }
      const api = new MockApi(GetEmailAuthErr);
      api.token = 'invalid';
      api.fetchEmailData(1, 'deathangel908@gmail.com', (ok, err) => {
        assert.include(err, 'Token has expired', 'Expected auth error with invalid token');
        done();
      });
    });
    it('no email', done => {
      class GetEmailNoResErr extends XmlHttpRequestMock {
        getMockedResponse() {
          this.status = 400;
          return GET_EMAIL_NO_RES_ERR;
        }
      }
      const api = new MockApi(GetEmailNoResErr);
      api.token = validToken;
      api.fetchEmailData(1, 'deathangel908@gmail.com', (ok, err) => {
        assert.include(err, 'No such email', 'Expected no mail error with invalid id');
        done();
      });
    });
    it('no email', done => {
      class GetEmailNoResErr extends XmlHttpRequestMock {
        getMockedResponse() {
          this.status = 400;
          return GET_EMAIL_NO_ID;
        }
      }
      const api = new MockApi(GetEmailNoResErr);
      api.token = validToken;
      api.fetchEmailData(1, 'deathangel908@gmail.com', (ok, err) => {
        assert.include(err, 'Book not found', 'Expected error while with invalid book id');
        done();
      });
    });
  });
  describe('getMailLists', () => {
    it('success', done => {
      class GetGmailList extends XmlHttpRequestMock {
        getMockedResponse() {
          return GET_MAIL_LISTS;
        }
      }
      const api = new MockApi(GetGmailList);
      api.token = validToken;
      api.getMailLists((ok, err) => {
        assert.isNotOk(err);
        assert.deepEqual(ok, GET_MAIL_LISTS);
        done();
      });
    });
  });
});
