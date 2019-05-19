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

  test(callback) {
    return this._get({ path: '/test' }, callback);
  }

  test2() {
    throw new Error('ok');
  }

  _skip() {
    return;
  }

  test3(callback) {
    return this._get({ path: '/test' }, callback);
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
        ' - test (callback)',
        ' - test2 (callback)',
        ' - test3 (alias)',
        ' - fun (sync)',
        ' Sub1',
        '  - test (callback)',
        ' Sub2',
        '  - test (callback)',
      ];

      should(setup(tools.walk(Example), 0))
        .eql(['Example'].concat(data));
      should(setup(tools.walk(Example, 'Foo'), 0))
        .eql(['Foo'].concat(data));
      should(setup(tools.walk(Example, 'A', { name: 'B' }), 0))
        .eql(['B'].concat(data));
    });
  });
});
