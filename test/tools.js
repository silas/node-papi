'use strict';

/**
 * Module dependencies.
 */

require('should');

var bluebird = require('bluebird');
var lodash = require('lodash');
var nock = require('nock');
var should = require('should');
var util = require('util');

var papi = require('../lib');
var tools = require('../lib/tools');

/**
 * Example test
 */

function ExampleSub(example) {
  this.example = example;
}

ExampleSub.prototype.test = function(one, callback) {
  var body = { one: one };
  return this.example._post({ path: '/test/test', body: body }, callback);
};

function Example(opts) {
  papi.Client.call(this, opts);

  this.sub1 = new Example.Sub1(this);
  this.sub2 = new Example.Sub2(this);
}

Example.Sub1 = ExampleSub;
Example.Sub2 = ExampleSub;
Example.meta = {};

util.inherits(Example, papi.Client);

Example.prototype.test = function(callback) {
  return this._get({ path: '/test' }, callback);
};

Example.prototype.test2 = function() {
  throw new Error('ok');
};

Example.prototype._skip = function() {};

Example.meta.test3 = { type: 'alias' };

Example.prototype.test3 = Example.prototype.test;

Example.meta.fun = { type: 'sync' };

Example.prototype.fun = function() {
  return 49;
};

/**
 * Tests
 */

describe('tools', function() {
  before(function() {
    nock.disableNetConnect();
  });

  after(function() {
    nock.enableNetConnect();
  });

  beforeEach(function() {
    this.baseUrl = 'http://example.org';
    this.nock = nock(this.baseUrl);
  });

  describe('walk', function() {
    it('should work', function() {
      should(function() { tools.walk(); }).throw('invalid arguments');

      var setup = function(tree, depth, data) {
        data = data || [];

        var prefix = lodash.repeat(' ', depth);

        data.push(prefix + tree.name);

        lodash.each(tree.methods, function(method) {
          data.push(prefix + ' - ' + method.name + ' (' + method.type + ')');
        });

        lodash.each(tree.objects, function(tree) {
          setup(tree, depth + 1, data);
        });

        return data;
      };

      var data = [
        ' - test (callback)',
        ' - test2 (callback)',
        ' - test3 (alias)',
        ' - fun (sync)',
        ' Sub1',
        '  - test (callback)',
        ' Sub2',
        '  - test (callback)',
      ];

      setup(tools.walk(Example), 0)
        .should.eql(['Example'].concat(data));
      setup(tools.walk(Example, 'Foo'), 0)
        .should.eql(['Foo'].concat(data));
      setup(tools.walk(Example, 'A', { name: 'B' }), 0)
        .should.eql(['B'].concat(data));
    });
  });

  describe('promisify', function() {
    beforeEach(function() {
      this.client = new Example({ baseUrl: 'http://example.org' });
    });

    it('should work', function() {
      var c = this.client;

      should(function() { tools.promisify(); }).throw('client required');
      tools.promisify(c, function() {});
    });

    it('should support default promise', function(done) {
      tools.promisify(this.client);

      this.nock.get('/test').reply(200);

      this.client.test().then(function(res) {
        should(res.statusCode).equal(200);
        done();
      });
    });

    it('should support default promise error', function(done) {
      tools.promisify(this.client);

      this.nock.get('/test').reply(500);

      this.client.test().catch(function(err) {
        should(err).have.property('message', 'internal server error');
        done();
      });
    });

    it('should support default promise error', function(done) {
      tools.promisify(this.client);

      this.client.test2().catch(function(err) {
        should(err).have.property('message', 'ok');
        done();
      });
    });

    it('should support promise', function(done) {
      tools.promisify(this.client, bluebird.fromCallback);

      this.nock.get('/test').reply(200);

      this.client.test().then(function(res) {
        should(res.statusCode).equal(200);
        done();
      });
    });

    it('should support promise error', function(done) {
      tools.promisify(this.client, bluebird.fromCallback);

      this.nock.get('/test').reply(500);

      this.client.test().catch(function(err) {
        should(err).have.property('message', 'internal server error');
        done();
      });
    });

    it('should support callback', function(done) {
      tools.promisify(this.client, bluebird.fromCallback);

      this.nock.get('/test').reply(200);

      this.client.test(function(err, res) {
        should.not.exist(err);
        should(res.statusCode).equal(200);
        done();
      });
    });

    it('should support callback error', function(done) {
      tools.promisify(this.client, bluebird.fromCallback);

      this.nock.get('/test').reply(500);

      this.client.test(function(err) {
        should(err).have.property('message', 'internal server error');
        done();
      });
    });
  });
});
