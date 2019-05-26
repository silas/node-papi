'use strict';

const lodash = require('lodash');
const nock = require('nock');
const should = require('should');

const papi = require('../lib');
const tools = require('../lib/tools');

/**
 * Example test
 */

class ExampleSub {
  constructor(example) {
    this.example = example;
  }

  test(one, callback) {
    const body = { one: one };
    return this.example._post({ path: '/test/test', body: body }, callback);
  }
}

class Example extends papi.Client {
  constructor(opts) {
    super(opts);

    this.sub1 = new Example.Sub1(this);
    this.sub2 = new Example.Sub2(this);
  }

  test() {
    return this._get({ path: '/test' });
  }

  test2() {
    throw new Error('ok');
  }

  _skip() {
    return;
  }

  test3() {
    return this._get({ path: '/test' });
  }

  fun() {
    return 49;
  }
}

Example.Sub1 = ExampleSub;

Example.Sub2 = ExampleSub;

Example.meta = {
  test3: { type: 'alias' },
  fun: { type: 'sync' },
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
      should(() => tools.walk()).throw('invalid arguments');

      const setup = (tree, depth, data) => {
        data = data || [];

        const prefix = lodash.repeat(' ', depth);

        data.push(prefix + tree.name);

        lodash.each(tree.methods, method => {
          data.push(prefix + ' - ' + method.name + ' (' + method.type + ')');
        });

        lodash.each(tree.objects, tree => {
          setup(tree, depth + 1, data);
        });

        return data;
      };

      const data = [
        ' - test (promise)',
        ' - test2 (promise)',
        ' - test3 (alias)',
        ' - fun (sync)',
        ' Sub1',
        '  - test (promise)',
        ' Sub2',
        '  - test (promise)',
      ];

      should(setup(tools.walk(Example), 0))
        .eql(['Example'].concat(data));
      should(setup(tools.walk(Example, 'Foo'), 0))
        .eql(['Foo'].concat(data));
      should(setup(tools.walk(Example, 'A', { name: 'B' }), 0))
        .eql(['B'].concat(data));
    });
  });

  describe('callbackify', function() {
    beforeEach(function() {
      this.client = new Example({ baseUrl: 'http://example.org' });
    });

    it('should work', function() {
      const c = this.client;

      should(() => {
        tools.callbackify();
      }).throw('client required');

      tools.callbackify(c);
    });

    it('should handle ok', function(done) {
      tools.callbackify(this.client);

      this.nock.get('/test').reply(200);

      this.client.test((err, res) => {
        should.not.exist(err);
        should(res).have.property('statusCode', 200);
        done();
      });
    });

    it('should handle response error', function(done) {
      tools.callbackify(this.client);

      this.nock.get('/test').reply(500);

      this.client.test((err) => {
        should(err).have.property('message', 'internal server error');
        should(err).have.property('statusCode', 500);
        done();
      });
    });
  });
});
