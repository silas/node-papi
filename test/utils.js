'use strict';

const should = require('should');
const util = require('util');

const utils = require('../lib/utils');

/**
 * Helpers
 */

function inherited(prototype, properties) {
  function Parent() {}

  function Child() {
    for (var key in properties) {
      this[key] = properties[key];
    }
  }

  Parent.prototype = prototype;

  util.inherits(Child, Parent);

  return new Child();
}

/**
 * Tests
 */

describe('utils', function() {
  describe('isEmpty', function() {
    it('should handle empty values', function() {
      should(utils.isEmpty(null)).equal(true);
      should(utils.isEmpty(false)).equal(true);
      should(utils.isEmpty([])).equal(true);
      should(utils.isEmpty(true)).equal(true);
      should(utils.isEmpty({})).equal(true);

      Object.prototype.jerk = true;
      should(utils.isEmpty({})).equal(true);
      delete Object.prototype.jerk;
    });

    it('should handle non-empty values', function() {
      should(utils.isEmpty(['one'])).equal(false);
      should(utils.isEmpty({ hello: 'world' })).equal(false);
    });
  });

  describe('merge', function() {
    it('should merge nothing', function() {
      should(utils.merge()).eql({});
    });

    it('should merge objects', function() {
      const values = utils.merge(
        { one: 1, ok: 1 },
        { two: 2, ok: 2, One: 2 },
        { three: 3, done: 'yes' }
      );

      should(values).eql({
        one: 1,
        two: 2,
        ok: 2,
        One: 2,
        three: 3,
        done: 'yes',
      });
    });

    it('should not merge inherited properties', function() {
      const values = utils.merge(
        { a: 1 },
        inherited({ b: 2 }, { c: 3 })
      );

      should(values).eql({ a: 1, c: 3 });
    });
  });

  describe('mergeHeaders', function() {
    it('should merge nothing', function() {
      should(utils.mergeHeaders()).eql({});
    });

    it('should merge headers', function() {
      const one = {
        'Content-Length': 123,
        'content-type': 'application/json',
        host: 'google.com',
      };

      const two = {
        'content-length': 321,
        'X-Request-Id': 'abc',
      };

      const three = utils.mergeHeaders(one, two);

      should(one).eql({
        'Content-Length': 123,
        'content-type': 'application/json',
        host: 'google.com',
      });

      should(two).eql({
        'content-length': 321,
        'X-Request-Id': 'abc',
      });

      should(three).eql({
        'content-length': 321,
        'content-type': 'application/json',
        host: 'google.com',
        'x-request-id': 'abc',
      });
    });

    it('should not merge inherited properties', function() {
      const values = utils.mergeHeaders(
        { A: 1 },
        inherited({ B: 2 }, { C: 3 })
      );

      should(values).eql({ a: 1, c: 3 });
    });
  });

  describe('pick', function() {
    it('should pick from arguments', function() {
      const data = { zero: 0, one: 1, two: 2 };
      should(utils.pick(data, 'zero', 'two')).eql({ zero: 0, two: 2 });
    });

    it('should pick from an array', function() {
      const data = { zero: 0, one: 1, two: 2 };
      should(utils.pick(data, ['zero', 'two'])).eql({ zero: 0, two: 2 });
    });
  });
});
