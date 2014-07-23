'use strict';

/**
 * Module dependencies.
 */

require('should');

var utils = require('../lib/utils');

/**
 * Tests
 */

describe('utils', function() {
  describe('isEmpty', function() {
    it('should handle empty values', function() {
      utils.isEmpty(null).should.equal(true);
      utils.isEmpty(false).should.equal(true);
      utils.isEmpty([]).should.equal(true);
      utils.isEmpty(true).should.equal(true);
    });

    it('should handle non-empty values', function() {
      utils.isEmpty(['one']).should.equal(false);
      utils.isEmpty({ hello: 'world' }).should.equal(false);
    });
  });

  describe('merge', function() {
    it('should merge nothing', function() {
      utils.merge().should.eql({});
    });

    it('should merge objects', function() {
      var values = utils.merge(
        { one: 1, ok: 1 },
        { two: 2, ok: 2, One: 2 },
        { three: 3, done: 'yes' }
      );

      values.should.eql({
        one: 1,
        two: 2,
        ok: 2,
        One: 2,
        three: 3,
        done: 'yes',
      });
    });
  });

  describe('mergeHeaders', function() {
    it('should merge nothing', function() {
      utils.mergeHeaders().should.eql({});
    });

    it('should merge headers', function() {
      var one = {
        'Content-Length': 123,
        'content-type': 'application/json',
        host: 'google.com',
      };

      var two = {
        'content-length': 321,
        'X-Request-Id': 'abc',
      };

      var three = utils.mergeHeaders(one, two);

      one.should.eql({
        'Content-Length': 123,
        'content-type': 'application/json',
        host: 'google.com',
      });

      two.should.eql({
        'content-length': 321,
        'X-Request-Id': 'abc',
      });

      three.should.eql({
        'content-length': 321,
        'content-type': 'application/json',
        host: 'google.com',
        'x-request-id': 'abc',
      });
    });
  });

  describe('pick', function() {
    it('should pick from arguments', function() {
      var data = { zero: 0, one: 1, two: 2 };
      utils.pick(data, 'zero', 'two').should.eql({ zero: 0, two: 2 });
    });

    it('should pick from an array', function() {
      var data = { zero: 0, one: 1, two: 2 };
      utils.pick(data, ['zero', 'two']).should.eql({ zero: 0, two: 2 });
    });
  });
});
