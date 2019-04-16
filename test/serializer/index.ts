'use strict';

import { assert } from 'chai';
import serialize from '../../src/helpers/serializer';
const ADD_MAIL = require('./add_mail.json');
let expected = `a:2:{i:0;a:2:{s:5:"email";s:13:"test@test.com";s:9:"variables";a:2:{s:4:"var1";s:4:"val1";s:4:"var2";s:4:"val2";}}i:1;a:2:{s:5:"email";s:14:"test2@test.com";s:9:"variables";a:1:{s:4:"var3";s:4:"val3";}}}`;

describe('serializer', function () {
  it('should serialize add_mail', function (done) {
    let res = serialize(ADD_MAIL);
    assert.equal(expected, res);
    done();
  });
});
