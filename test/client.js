'use strict';

/* jshint expr: true */

const debug = require('debug')('papi');
const events = require('events');
const http = require('http');
const https = require('https');
const lodash = require('lodash');
const nock = require('nock');
const should = require('should');
const sinon = require('sinon');
const stream = require('stream');
const url = require('url');

const meta = require('../package.json');
const papi = require('../lib');

const FORM = 'application/x-www-form-urlencoded';
const CHARSET = 'charset=utf-8';
const BASE_URL = 'http://example.org';

const make = () => new papi.Client(BASE_URL);

describe('Client', function() {
  describe('new', function() {
    it('should accept string as baseUrl', function() {
      const client = make();

      const baseUrl = client._opts.baseUrl;

      should(baseUrl).eql({
        auth: null,
        hostname: 'example.org',
        path: '',
        port: null,
        protocol: 'http:'
      });
    });

    it('should not mutate options', function() {
      const options = {
        baseUrl: url.parse('http://example.org'),
        headers: { hello: 'world' },
        type: 'text',
        encoders: { text: () => undefined },
        decoders: { text: () => undefined },
        tags: ['test'],
        timeout: 123,
      };

      const optionsClone = lodash.cloneDeep(options);

      const client = new papi.Client(options);

      client._opts.baseUrl.fail = true;
      client._opts.headers.fail = true;
      client._opts.type = true;
      client._opts.encoders.fail = true;
      client._opts.decoders.fail = true;
      client._opts.tags.push('fail');
      client._opts.timeout = 123;

      should(options).eql(optionsClone);
    });

    it('should require baseUrl', function() {
      should(() => new papi.Client()).throw(Error, {
        message: 'baseUrl required',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should require baseUrl be a string', function() {
      should(() => new papi.Client({ baseUrl: 123 })).throw(Error, {
        message: 'baseUrl must be a string: 123',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should require tags be an array', function() {
      should(() => {
        new papi.Client({ baseUrl: BASE_URL, tags: true });
      }).throw(Error, {
        message: 'tags must be an array',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should error on trailing slash', function() {
      should(() => new papi.Client(BASE_URL + '/nope/')).throw(Error, {
        message: 'baseUrl must not end with a forward slash',
        isPapi: true,
        isValidation: true,
      });
    });
  });

  describe('err', function() {
    it('should return nothing', function() {
      should.not.exist(make()._err());
    });

    it('should convert string to error', function() {
      const err = make()._err('test');

      should(err).be.instanceof(Error);

      should(err.message).eql('test');
    });

    it('should not change error', function() {
      const message = 'ok';

      const err1 = new Error(message);
      const err2 = make()._err(err1);

      should(err2).be.instanceof(Error);
      should(err2).equal(err1);
      should(err2.message).eql(message);
    });

    it('should add client name', function() {
      const client = make();

      client._opts.name = 'client';

      const err = client._err('ok');

      should(err.message).eql('client: ok');
    });

    it('should add opts name', function() {
      const opts = { name: 'opts' };

      const err = make()._err('ok', opts);

      should(err.message).eql('opts: ok');
    });

    it('should add client and opts name', function() {
      const client = make();

      client._opts.name = 'client';

      const err = client._err('ok', { name: 'opts' });

      should(err.message).eql('client: opts: ok');
    });
  });

  describe('ext', function() {
    it('should register extension', function() {
      const client = make();

      should(client._exts).be.empty;

      const name = 'test';

      client._ext(name, lodash.noop);

      should(client._exts).have.keys(name);
      should(client._exts[name]).be.instanceof(Array);
      should(client._exts[name]).eql([lodash.noop]);

      client._ext(name, lodash.noop);

      should(client._exts[name]).eql([lodash.noop, lodash.noop]);
    });

    it('should require an event name', function() {
      should(() => make()._ext()).throw(Error, {
        message: 'extension eventName required',
        isPapi: true,
        isValidation: true,
      });

      should(() => make()._ext(true)).throw(Error, {
        message: 'extension eventName required',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should require callback', function() {
      should(() => make()._ext('test')).throw(Error, {
        message: 'extension callback required',
        isPapi: true,
        isValidation: true,
      });
    });
  });

  describe('plugin', function() {
    it('should register', function(done) {
      const client = make();

      const options = {};
      const plugin = {};

      plugin.register = (pluginClient, pluginOptions) => {
        should(pluginClient).equal(client);
        should(pluginOptions).equal(options);

        done();
      };

      plugin.register.attributes = {
        name: 'test',
        version: '0.0.0',
      };

      client._plugin(plugin, options);
    });

    it('should require plugin option', function() {
      should(() => make()._plugin()).throw(Error, {
        message: 'plugin required',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should require register be a function', function() {
      const plugin = {
        register: {},
      };

      should(() => make()._plugin(plugin)).throw(Error, {
        message: 'plugin must have register function',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should require attributes', function() {
      const plugin = {
        register: () => {},
      };

      should(() => make()._plugin(plugin)).throw(Error, {
        message: 'plugin attributes required',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should require attributes name', function() {
      const plugin = {
        register: () => {},
      };

      plugin.register.attributes = {};

      should(() => make()._plugin(plugin)).throw(Error, {
        message: 'plugin attributes name required',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should require attributes version', function() {
      const plugin = {
        register: () => {},
      };

      plugin.register.attributes = {
        name: 'test',
      };

      should(() => make()._plugin(plugin)).throw(Error, {
        message: 'plugin attributes version required',
        isPapi: true,
        isValidation: true,
      });
    });

    it('should set default options', function(done) {
      const plugin = {
        register: (client, options) => {
          should.exist(options);

          done();
        },
      };

      plugin.register.attributes = {
        name: 'test',
        version: '1.2.3',
      };

      make()._plugin(plugin);
    });
  });

  describe('log', function() {
    it('should emit logs', function(done) {
      const client = make();

      client.on('log', (tags, data) => {
        should(tags).eql(['tag1', 'tag2']);
        should(data).eql('done');

        done();
      });

      client._log(['tag1', 'tag2'], 'done');
    });
  });

  describe('encode', function() {
    it('should throw on unknown encoder', function() {
      should(() => make()._encode('fail')).throw(Error, {
        message: 'unknown encoder: fail',
        isPapi: true,
        isCodec: true,
      });
    });

    it('should throw on invalid content', function() {
      const data = {};
      data[data] = data;

      should(() => make()._encode('application/json', data)).throw(Error, {
        message: new RegExp('^encode \\(application/json\\) failed: ' +
                            'Converting circular structure to JSON.*'),
        isPapi: true,
        isCodec: true,
      });
    });
  });

  describe('decode', function() {
    it('should throw on unknown decoder', function() {
      should(() => make()._decode('fail')).throw(Error, {
        message: 'unknown decoder: fail',
        isPapi: true,
        isCodec: true,
      });
    });

    it('should throw on invalid content', function() {
      should(() => {
        make()._decode('application/json', '<html>');
      }).throw(Error, function(err) {
        should(err.message)
          .startWith('decode (application/json) failed: Unexpected token <');
        should(err).have.property('isPapi', true);
        should(err).have.property('isCodec', true);
      });
    });
  });

  describe('push', function() {
    it('should push method item', function() {
      const request = {
        _stack: [],
        opts: { exts: { test: lodash.noop } },
      };

      make().__push(request, 'test');

      should(request._stack).eql([lodash.noop]);
    });

    it('should push client and method items', function() {
      const client = make();

      const one = () => {};
      const two = () => {};

      client._ext('test', one);

      const request = {
        _stack: [],
        opts: { exts: {} },
      };

      request.opts.exts.test = [two];

      client.__push(request, 'test');

      should(request._stack).eql([one, two]);
    });
  });

  describe('request', function() {
    beforeEach(function() {
      this.client = new papi.Client({
        baseUrl: BASE_URL,
        headers: { key: 'value' },
        name: 'testclient',
      });
    });

    it('should not crash with null opts', async function() {
      try {
        await this.client._request();
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: path required');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should not crash helper methods with null opts', async function() {
      try {
        await this.client._get();
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: path required');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should require all params', async function() {
      const req = {
        path: '/one/{two}',
      };

      try {
        await this.client._get(req);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: missing param: two');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should handle query encode errors', async function() {
      const req = {
        path: '/get',
        query: 'fail',
      };

      const mime = 'application/x-www-form-urlencoded';

      this.client._opts.encoders[mime] = () => {
        throw new Error('something went wrong');
      };

      try {
        await this.client._get(req);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: encode (' + mime +
            ') ' + 'failed: something went wrong');
        should(err).have.property('isPapi', true);
        should(err).have.property('isCodec', true);
      }
    });

    it('should handle body encode errors', async function() {
      const data = {};
      data[data] = data;

      const req = {
        path: '/get',
        type: 'json',
        body: data,
      };

      try {
        await this.client._post(req);
        should.fail();
      } catch (err) {
        should.exist(err);
        should(err).have.property('message');
        should(err.message).match(new RegExp('^testclient: encode ' +
            '\\(application/json\\) failed: Converting circular structure to ' +
            'JSON.*'));
        should(err).have.property('isPapi', true);
        should(err).have.property('isCodec', true);
      }
    });
  });

  describe('pipeline', function() {
    beforeEach(function() {
      this.client = new papi.Client({ baseUrl: BASE_URL });
      this.request = { _stack: [] };
      this.promise = new Promise((resolve, reject) => {
        this.request._resolve = resolve;
        this.request._reject = reject;
      });
    });

    it('should handle empty stack', async function() {
      this.request.res = 'ok';
      this.client.__pipeline(this.request);
      should(await this.promise).eql('ok');
    });

    it('should handle error', function() {
      function error(request, next) {
        next(new Error('error'));
      }

      this.request._stack = [error];
      this.client.__pipeline(this.request);

      return should(this.promise).rejectedWith('error');
    });

    it('should handle value', async function() {
      function value(request, next) {
        next(false, 'value');
      }

      this.request._stack = [value];
      this.client.__pipeline(this.request);

      return should(await this.promise).eql('value');
    });

    it('should handle legacy callback error', function() {
      function error(request, next) {
        next(false, new Error('legacy error'));
      }

      this.request._stack = [error];
      this.client.__pipeline(this.request);

      return should(this.promise).rejectedWith('legacy error');
    });

    it('should handle legacy callback value', async function() {
      function value(request, next) {
        next(false, null, 'legacy value');
      }

      this.request._stack = [value];
      this.client.__pipeline(this.request);

      return should(await this.promise).eql('legacy value');
    });
  });

  describe('http', function() {
    beforeEach(function() {
      const self = this;

      self.sinon = sinon.createSandbox();

      self.http = {};
      self.https = {};

      function request(type) {
        return opts => {
          const req = self[type].req = new events.EventEmitter();
          const res = self[type].res = new events.EventEmitter();

          res.statusCode = 200;
          res.headers = {};
          res.socket = {
            remoteAddress: '127.0.0.1',
            remotePort: 80,
          };

          req.abort = () => {
            opts._aborted = true;
          };

          req.getHeader = name => {
            return opts.headers[name.toLowerCase()];
          };

          req.setHeader = (name, value) => {
            opts.headers[name.toLowerCase()] = value;
          };

          req.removeHeader = (name) => {
            delete opts.headers[name.toLowerCase()];
          };

          req.setTimeout = (timeout) => {
            self.timeout = timeout;
          };

          req.end = () => {
            self[type].opts = opts;

            req.emit('response', res);
          };

          return req;
        };
      }

      self.sinon.stub(http, 'request').callsFake(request('http'));
      self.sinon.stub(https, 'request').callsFake(request('https'));
    });

    afterEach(function() {
      this.sinon.restore();
    });

    it('should handle http', function() {
      const protocol = 'http:';
      const hostname = 'example.org';
      const method = 'GET';

      const baseUrl = protocol + '//' + hostname;

      const client = new papi.Client({
        baseUrl: baseUrl,
        timeout: 1000,
        agent: false,
      });

      client._get('/one', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).eql({
          headers: { 'user-agent': 'papi/' + meta.version },
          hostname: hostname,
          method: method,
          path: '/one',
          port: 80,
          agent: false,
        });
      });
    });

    it('should handle options', function() {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      client._options('/options', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).have.property('method', 'OPTIONS');
      });
    });

    it('should handle get', function() {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      client._get('/get', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).have.property('method', 'GET');
      });
    });

    it('should handle head', function() {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      client._head('/head', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).have.property('method', 'HEAD');
      });
    });

    it('should handle post', function() {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      client._post('/post', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).have.property('method', 'POST');
      });
    });

    it('should handle put', function() {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      client._put('/put', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).have.property('method', 'PUT');
      });
    });

    it('should handle delete', function() {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      client._delete('/delete', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).have.property('method', 'DELETE');
      });
    });

    it('should handle del', function() {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      client._del('/del', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).have.property('method', 'DELETE');
      });
    });

    it('should handle patch', function() {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      client._patch('/patch', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).have.property('method', 'PATCH');
      });
    });

    it('should handle http explicit', function(done) {
      const protocol = 'http:';
      const auth = 'user:pass';
      const port = '8000';
      const hostname = 'example.org';
      const method = 'GET';

      const baseUrl = protocol + '//' + auth + '@' + hostname + ':' + port +
        '/one';

      const client = new papi.Client({
        baseUrl: baseUrl,
        headers: { 'user-agent': null },
      });

      client._get('/two', lodash.noop);

      process.nextTick(() => {
        should(this.http.opts).eql({
          auth: auth,
          headers: {},
          hostname: hostname,
          method: method,
          path: '/one/two',
          port: port,
        });

        done();
      });
    });

    it('should handle https', function(done) {
      const protocol = 'https:';
      const hostname = 'example.org';
      const method = 'GET';

      const baseUrl = protocol + '//' + hostname;

      const client = new papi.Client({ baseUrl: baseUrl });

      const opts = {
        path: '/one',
        agent: false,
        key: 'key',
        passphrase: 'passphrase',
        ciphers: 'ciphers',
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_method',
      };

      client._get(opts, lodash.noop);

      process.nextTick(() => {
        should(this.https.opts).eql({
          headers: { 'user-agent': 'papi/' + meta.version },
          hostname: hostname,
          method: method,
          path: '/one',
          port: 443,
          agent: false,
          key: 'key',
          passphrase: 'passphrase',
          ciphers: 'ciphers',
          rejectUnauthorized: false,
          secureProtocol: 'TLSv1_method',
        });

        done();
      });
    });

    it('should handle https explicit', function(done) {
      const protocol = 'https:';
      const auth = 'user:pass';
      const port = '4433';
      const hostname = 'example.org';
      const method = 'GET';

      const baseUrl = protocol + '//' + auth + '@' + hostname + ':' + port +
        '/one';

      const client = new papi.Client({ baseUrl: baseUrl });

      client._get('/two', lodash.noop);

      process.nextTick(() => {
        should(this.https.opts).eql({
          auth: auth,
          headers: { 'user-agent': 'papi/' + meta.version },
          hostname: hostname,
          method: method,
          path: '/one/two',
          port: port,
        });

        done();
      });
    });

    it('should handle multiple events with abort', function(done) {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      let called = 0;
      let errors = 0;

      const opts = {
        path: '/one',
        ctx: new events.EventEmitter(),
      };

      client._get(opts, () => {
        if (!called) {
          this.http.req.on('error', () => {
            if (!errors) {
              should(called).equal(1);
              done();
            }
            errors++;
          });
        }

        called++;

        for (let i = 0; i < 2; i++) {
          this.http.req.emit('error', new Error('req error'));
          this.http.req.emit('timeout', new Error('req timeout'));
          this.http.res.emit('end');
        }
      });

      opts.ctx.emit('cancel');
    });

    it('should handle multiple events with timeout', function(done) {
      const client = new papi.Client({ baseUrl: 'http://example.org' });
      let called = 0;
      let errors = 0;

      const opts = {
        path: '/one',
        timeout: 10,
      };

      client._get(opts, () => {
        if (!called) {
          this.http.req.on('error', () => {
            if (!errors) {
              should(called).equal(1);
              done();
            }
            errors++;
          });
        }

        called++;

        for (let i = 0; i < 2; i++) {
          this.http.req.emit('error', new Error('req error'));
          this.http.req.emit('timeout', new Error('req timeout'));
          this.http.res.emit('end');
        }
      });
    });
  });

  describe('nock', function() {
    before(function() {
      nock.disableNetConnect();
    });

    after(function() {
      nock.enableNetConnect();
    });

    beforeEach(function() {
      this.baseUrl = 'http://example.org';

      this.client = new papi.Client({
        baseUrl: this.baseUrl,
        headers: { key: 'value' },
        name: 'testclient',
      });
      this.client.on('log', debug);

      this.nock = nock(this.baseUrl);
    });

    it('should GET text/plain', async function() {
      this.nock
        .get('/get')
        .reply(200, 'ok', { 'content-type': 'text/plain' });

      const res = await this.client._get('/get');
      should(res).have.property('body','ok');
    });

    it('should GET text/html', async function() {
      this.nock
        .get('/get')
        .reply(200, 'ok', { 'content-type': 'text/html' });

      const res = await this.client._get('/get');
      should(res).have.property('body','ok');
    });

    it('should GET application/json', async function() {
      this.nock
        .get('/get')
        .reply(200,
          JSON.stringify({ is: 'ok' }),
          { 'content-type': 'application/json' }
        );

      const res = await this.client._get('/get');
      should(res).have.property('body',{ is: 'ok' });
      should(res).have.property('statusCode', 200);
    });

    it('should return buffer', async function() {
      this.nock
        .get('/get')
        .reply(200, 'ok');

      const res = await this.client._get('/get');
      should(res).have.property('body');
      should(res.body).be.instanceof(Buffer);
      should(res.body).have.property('length', 2);
      should(res).have.property('statusCode', 200);
    });

    it('should return buffer for known content-types', async function() {
      this.nock
        .get('/get')
        .reply(200, { hello: 'world' });

      const opts = {
        path: '/get',
        buffer: true,
      };

      const res = await this.client._get(opts);
      should(res).have.property('body');
      should(res.body).be.instanceof(Buffer);
      should(res.body.toString()).eql('{"hello":"world"}');
      should(res).have.property('statusCode', 200);
    });

    it('should handle response decode errors', async function() {
      this.nock
        .get('/get')
        .reply(200, '<html>', { 'content-type': 'application/json' });

      try {
        await this.client._get('/get');
        should.fail();
      } catch (err) {
        should.exist(err);
        should(err.message).startWith('testclient: decode (application/json) ' +
            'failed: Unexpected token <');
        should(err).have.property('isPapi', true);
        should(err).have.property('isCodec', true);
      }
    });

    it('should create request with path replacement', async function() {
      this.nock
        .get('/hello%20world/0/hello%20world/2/')
        .reply(200);

      const opts = {
        path: '/{saying}/0/{saying}/{count}/',
        params: { saying: 'hello world', count: 2 },
      };

      const res = await this.client._get(opts);
      should(res).have.property('statusCode', 200);
    });

    it('should support unescaped path params', async function() {
      this.nock
        .get('/hello%2Bworld/')
        .reply(200);

      const opts = {
        path: '/{test}/{extra}',
        params: { extra: null },
      };

      opts.params.test = Buffer.from('hello%2Bworld');
      opts.params.test.encode = false;

      const res = await this.client._get(opts);
      should(res).have.property('statusCode', 200);
    });

    it('should create request with query parameters', async function() {
      this.nock
        .get('/get?one=one&two=two1&two=two2')
        .reply(200);

      const opts = {
        path: '/get',
        query: { one: 'one', two: ['two1', 'two2'] },
      };

      const res = await this.client._get(opts);
      should(res).have.property('statusCode', 200);
    });

    it('should set default user-agent', async function() {
      this.nock
        .get('/get')
        .matchHeader('user-agent', 'papi/' + meta.version)
        .reply(200);

      await this.client._get('/get');
    });

    it('should use custom user-agent', async function() {
      this.nock
        .get('/get')
        .matchHeader('user-agent', 'foo')
        .reply(200);

      const opts = {
        path: '/get',
        headers: { 'User-Agent': 'foo' },
      };

      await this.client._get(opts);
    });

    it('should use default headers', async function() {
      this.nock
        .get('/get')
        .matchHeader('key', 'value')
        .matchHeader('myKey', 'myValue')
        .reply(200);

      const opts = {
        path: '/get',
        headers: { myKey: 'myValue' },
      };

      await this.client._get(opts);
    });

    it('should use passed over default headers', async function() {
      this.nock
        .get('/get')
        .matchHeader('key', 'value')
        .reply(200);

      const opts = {
        path: '/get',
        headers: { key: 'value' },
      };

      await this.client._request(opts);
    });

    it('should handle Buffer body', async function() {
      this.nock
        .post('/post', 'test')
        .matchHeader('content-type', 'custom')
        .matchHeader('content-length', 4)
        .reply(200);

      const opts = {
        path: '/post',
        body: Buffer.from('test'),
        headers: { 'content-type': 'custom' },
      };

      await this.client._post(opts);
    });

    it('should handle function body', async function() {
      this.nock
        .post('/post', 'test')
        .matchHeader('content-type', 'custom')
        .matchHeader('content-length', 4)
        .reply(200);

      const opts = {
        path: '/post',
        body: () => Buffer.from('test'),
        headers: { 'content-type': 'custom' },
      };

      await this.client._post(opts);
    });

    it('should catch function body errors', async function() {
      const opts = {
        path: '/post',
        body: () => { throw new Error('body'); },
        type: 'json',
      };

      try {
        await this.client._post(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: body');
        should(err).not.have.property('isPapi');
      }
    });

    it('should handle stream.Readable body', async function() {
      this.nock
        .post('/post', 'test')
        .reply(200);

      const body = new stream.Readable();

      body.push(Buffer.from('test'));
      body.push(null);

      const opts = {
        path: '/post',
        body: body,
      };

      await this.client._post(opts);
    });

    it('should handle stream.Writable pipe', async function() {
      this.nock
        .get('/get')
        .reply(200, { hello: 'world' });

      const chunks = [];

      const bodyPipe = new stream.Writable();

      bodyPipe._write = (chunk, encoding, callback) => {
        chunks.push(chunk);

        callback();
      };

      const opts = {
        path: '/get',
        pipe: bodyPipe,
      };

      await this.client._get(opts);

      should(Buffer.concat(chunks).toString()).eql('{"hello":"world"}');
    });

    it('should handle function stream.Writable pipe', async function() {
      this.nock
        .get('/get')
        .reply(200, { hello: 'world' });

      const chunks = [];

      const bodyPipe = () => {
        const s = new stream.Writable();

        s._write = (chunk, encoding, callback) => {
          chunks.push(chunk);

          callback();
        };

        return s;
      };

      const opts = {
        path: '/get',
        pipe: bodyPipe,
      };

      await this.client._get(opts);

      should(Buffer.concat(chunks).toString()).eql('{"hello":"world"}');
    });

    it('should require stream.Writable for pipe', async function() {
      const opts = {
        path: '/get',
        pipe: true,
      };

      try {
        await this.client._get(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: pipe must be a ' +
          'writable stream');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should error error on function pipe', async function() {
      const bodyPipe = () => { throw new Error('pipe'); };

      const opts = {
        path: '/get',
        pipe: bodyPipe,
      };

      try {
        await this.client._get(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: pipe');
        should(err).not.have.property('isPapi');
      }
    });

    it('should POST application/x-www-form-urlencoded', async function() {
      this.nock
        .post('/post', 'hello=world')
        .matchHeader('content-type', FORM + '; ' + CHARSET)
        .reply(200);

      const opts = {
        path: '/post',
        type: 'form',
        body: { hello: 'world' },
      };

      await this.client._post(opts);
    });

    it('should DELETE', async function() {
      this.nock
        .delete('/delete')
        .reply(204);

      await this.client._delete('/delete');
    });

    it('should PATCH application/json', async function() {
      this.nock
        .patch('/patch', { hello: 'world' })
        .reply(204);

      const opts = {
        path: '/patch',
        type: 'json',
        body: { hello: 'world' },
      };

      await this.client._patch(opts);
    });

    it('should error for unknown type', async function() {
      const opts = {
        path: '/patch',
        body: { hello: 'world' },
      };

      try {
        await this.client._patch(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: type required');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should require path', async function() {
      try {
        await this.client._request({});
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: path required');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should return error when ctx is canceled', async function() {
      const ctx = new events.EventEmitter();
      ctx.canceled = true;

      const opts = { path: '/get', ctx: ctx };

      try {
        await this.client._request(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message',
          'testclient: ctx already canceled');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should return error when ctx is finished', async function() {
      const ctx = new events.EventEmitter();
      ctx.finished = true;

      const opts = { path: '/get', ctx: ctx };

      try {
        await this.client._request(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message',
          'testclient: ctx already finished');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should use content-type for type', async function() {
      this.nock
        .patch('/patch', { hello: 'world' })
        .reply(204);

      const opts = {
        path: '/patch',
        headers: { 'content-type': 'application/json' },
        body: { hello: 'world' },
      };

      await this.client._patch(opts);
    });

    it('should throw error for unknown content-type', async function() {
      const opts = {
        path: '/patch',
        headers: { 'content-type': 'x' },
        body: { hello: 'world' },
      };

      try {
        await this.client._patch(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: type is unknown: x');
        should(err).have.property('isPapi', true);
        should(err).have.property('isCodec', true);
      }
    });

    it('should return error for non-2xx', async function() {
      this.nock
        .post('/post')
        .reply(400);

      try {
        await this.client._post('/post');
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: bad request');
        should(err).have.property('statusCode', 400);
        should(err).have.property('isPapi', true);
        should(err).have.property('isResponse', true);
      }
    });

    it('should set err.message to body text', async function() {
      this.nock
        .post('/post')
        .reply(400, 'validation error', { 'content-type': 'text/plain' });

      try {
        await this.client._post('/post');
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: validation error');
        should(err).have.property('statusCode', 400);
        should(err).have.property('isPapi', true);
        should(err).have.property('isResponse', true);
      }
    });

    it('should set err.message for unknown status codes', async function() {
      this.nock
        .post('/post')
        .reply(499);

      try {
        await this.client._post('/post');
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: request failed: 499');
        should(err).have.property('statusCode', 499);
        should(err).have.property('isPapi', true);
        should(err).have.property('isResponse', true);
      }
    });

    it('should emit log events', async function() {
      this.nock
        .post('/post', { name: 'world' })
        .reply(200, { hello: 'world' });

      const events = [];

      this.client._opts.tags = ['class'];
      this.client.on('log', function() {
        events.push(Array.prototype.slice.call(arguments));
      });

      const opts = {
        name: 'method',
        path: '/post',
        body: { name: 'world' },
        type: 'json',
        tags: ['test'],
      };

      const res = await this.client._post(opts);
      should.exist(res);

      should(events.length).eql(2);

      should(events[0][0]).eql(['papi', 'request', 'test', 'class',
        'method']);
      should(events[0][1]).eql({
        hostname: 'example.org',
        port: 80,
        path: '/post',
        method: 'POST',
        headers: {
          key: 'value',
          'content-type': 'application/json; charset=utf-8',
          'content-length': 16,
        },
      });

      should(events[1][0]).eql(['papi', 'response', 'test', 'class',
                              'method']);
      should(events[1][1]).eql({
        statusCode: 200,
        path: '/post',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        remoteAddress: '127.0.0.1',
        remotePort: 80,
      });
    });

    it('should call request extensions', async function() {
      const called = [];
      const path = '/get';
      const statusCode = 200;

      this.nock
        .get(path)
        .reply(statusCode, { hello: 'world' });

      this.client._ext('onCreate', (request, next) => {
        should.exist(request);

        called.push('onCreate');

        next();
      });

      this.client._ext('onRequest', (request, next) => {
        should.exist(request);

        called.push('onRequest');

        next();
      });

      this.client._ext('onResponse', (request, next) => {
        should(request).have.properties('opts', 'state');

        should(request.opts).eql({
          headers: {},
          query: {},
          params: {},
          path: path,
          method: 'GET',
          tags: ['testclient'],
        });

        should(request.req.method).eql('GET');
        should(request.req.headers).eql({ key: 'value' });

        should.not.exist(request.err);
        should.exist(request.res);

        should(request.res).have.properties('statusCode', 'headers', 'body');

        should(request.res.statusCode).eql(statusCode);
        should(request.res.headers).eql({ 'content-type': 'application/json' });
        should(request.res.body).eql({ hello: 'world' });

        called.push('onResponse');

        next();
      });

      const res = await this.client._get('/get');
      should.exist(res);

      should(called).eql(['onCreate', 'onRequest', 'onResponse']);
    });

    it('should support retry', async function() {
      this.nock
        .get('/retry')
        .reply(500, 'error1')
        .get('/retry')
        .reply(503, 'error2')
        .get('/retry')
        .reply(200, { hello: 'world' });

      const responses = [];

      this.client._ext('onResponse', (request, next) => {
        responses.push(request.res.statusCode);

        if (Math.floor(request.res.statusCode / 100) !== 5) return next();

        request.retry();
      });

      const res = await this.client._get('/retry');
      should.exist(res);

      should(responses).eql([500, 503, 200]);
    });

    it('should error retry when body is a stream', async function() {
      this.nock
        .post('/retry', 'test')
        .reply(503);

      this.client._ext('onResponse', (request, next) => {
        try {
          request.retry();
        } catch (err) {
          next(err);
        }
      });

      const req = {
        path: '/retry',
        body: new stream.Readable(),
      };

      req.body.push(Buffer.from('test'));
      req.body.push(null);

      try {
        await this.client._post(req);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: request is not ' +
          'retryable');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should retry when body is a function stream', async function() {
      this.nock
        .post('/retry', 'test')
        .reply(503)
        .post('/retry', 'test')
        .reply(200);

      const responses = [];

      this.client._ext('onResponse', (request, next) => {
        responses.push(request.res.statusCode);

        if (Math.floor(request.res.statusCode / 100) !== 5) return next();

        request.retry();
      });

      const body = () => {
        const s = new stream.Readable();
        s.push(Buffer.from('test'));
        s.push(null);
        return s;
      };

      const req = {
        path: '/retry',
        body: body,
      };

      const res = await this.client._post(req);
      should.exist(res);

      should(responses).eql([503, 200]);
    });

    it('should error retry when pipe is stream.Writable', async function() {
      this.nock
        .get('/retry')
        .reply(500);

      this.client._ext('onResponse', (request, next) => {
        try {
          request.retry();
        } catch (err) {
          next(err);
        }
      });

      const req = {
        path: '/retry',
        pipe: new stream.Writable(),
      };

      try {
        await this.client._get(req);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: request is not ' +
          'retryable');
        should(err).have.property('isPapi', true);
        should(err).have.property('isValidation', true);
      }
    });

    it('should retry when pipe is a function stream', async function() {
      this.nock
        .get('/retry')
        .reply(503)
        .get('/retry')
        .reply(200, { hello: 'world' });

      const responses = [];

      this.client._ext('onResponse', (request, next) => {
        responses.push(request.res.statusCode);

        if (Math.floor(request.res.statusCode / 100) !== 5) return next();

        request.retry();
      });

      let chunks;

      const pipe = () => {
        chunks = [];

        const bodyPipe = new stream.Writable();

        bodyPipe._write = (chunk, encoding, callback) => {
          chunks.push(chunk);

          callback();
        };

        return bodyPipe;
      };

      const opts = {
        path: '/retry',
        pipe: pipe,
      };

      const res = await this.client._get(opts);
      should.exist(res);

      should(Buffer.concat(chunks).toString()).eql('{"hello":"world"}');

      should(responses).eql([503, 200]);
    });

    it('should execute all handlers', async function() {
      this.nock
        .get('/get')
        .reply(404, 'ok');

      function handleNotFound(request, next) {
        if (request.res && request.res.statusCode === 404) {
          request.res.body = undefined;
          delete request.err;
        }

        next();
      }

      function check(request, next) {
        should.not.exist(request.err);

        should.exist(request.res);
        should(request.res.body).equal(undefined);

        next(false, 'world');
      }

      const hello = await this.client._get('/get', handleNotFound, check);
      should(hello).eql('world');
    });

    it('should timeout request', async function() {
      this.nock
        .get('/get')
        .delayConnection(200)
        .reply(200);

      const opts = {
        path: '/get',
        timeout: 10,
      };

      try {
        await this.client._get(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: request timed out ' +
          '(10ms)');
        should(err).have.property('isPapi', true);
        should(err).have.property('isTimeout', true);
      }
    });

    it('should abort request', async function() {
      this.nock
        .get('/get')
        .delayConnection(200)
        .reply(200);

      const opts = {
        path: '/get',
        ctx: new events.EventEmitter(),
      };

      const future = this.client._get(opts);

      setTimeout(() => {
        opts.ctx.emit('cancel');
      }, 50);

      try {
        await future;
        should.fail();
      } catch (err) {
        should(err).have.property('message', 'testclient: request aborted');
        should(err).have.property('isPapi', true);
        should(err).have.property('isAbort', true);
      }
    });

    // this is get coverage for clearTimeout and ctx removeEventListener on end
    it('should clean abort/timeout on end', async function() {
      this.nock
        .get('/get')
        .reply(200);

      const opts = {
        path: '/get',
        ctx: new events.EventEmitter(),
        timeout: 100,
      };

      await this.client._get(opts);
    });

    // this is get coverage for clearTimeout and ctx removeEventListener on
    // error
    it('should clean abort/timeout on error', async function() {
      const opts = {
        path: '/get',
        ctx: new events.EventEmitter(),
        timeout: 100,
      };

      try {
        await this.client._get(opts);
        should.fail();
      } catch (err) {
        should(err).have.property('message');
        should(err.message).containEql('Nock');
      }
    });
  });
});
