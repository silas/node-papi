'use strict';

/* jshint expr: true */

/**
 * Module dependencies.
 */

var debug = require('debug')('papi');
var events = require('events');
var http = require('http');
var https = require('https');
var nock = require('nock');
var should = require('should');
var sinon = require('sinon');
var stream = require('stream');

var papi = require('../lib');

/**
 * Helper
 */

var FORM = 'application/x-www-form-urlencoded';
var CHARSET = 'charset=utf-8';
var BASE_URL = 'http://example.org';

function noop() {}

function make() {
  return papi.Client(BASE_URL);
}

/**
 * Tests
 */

describe('Client', function() {
  describe('new', function() {
    it('should accept string as baseUrl', function() {
      var client = make();

      var baseUrl = client._opts.baseUrl;

      baseUrl.protocol.should.eql('http:');
      baseUrl.host.should.eql('example.org');
      baseUrl.path.should.eql('');
      baseUrl.pathname.should.eql('');
    });

    it('should require baseUrl', function() {
      (function() {
        papi.Client();
      }).should.throw('baseUrl required');
    });

    it('should require baseUrl be a string', function() {
      (function() {
        papi.Client({ baseUrl: 123 });
      }).should.throw('baseUrl must be a string: 123');
    });

    it('should error on trailing slash', function() {
      (function() {
        papi.Client(BASE_URL + '/nope/');
      }).should.throw('baseUrl must not end with a forward slash');
    });
  });

  describe('err', function() {
    it('should return nothing', function() {
      should.not.exist(make()._err());
    });

    it('should convert string to error', function() {
      var err = make()._err('test');

      should(err).be.instanceof(Error);

      err.message.should.eql('test');
    });

    it('should not change error', function() {
      var message = 'ok';

      var err1 = new Error(message);
      var err2 = make()._err(err1);

      should(err2).be.instanceof(Error);
      err2.should.equal(err1);
      err2.message.should.eql(message);
    });

    it('should add client name', function() {
      var client = make();

      client._opts.name = 'client';

      var err = client._err('ok');

      err.message.should.eql('client: ok');
    });

    it('should add opts name', function() {
      var opts = { name: 'opts' };

      var err = make()._err('ok', opts);

      err.message.should.eql('opts: ok');
    });

    it('should add client and opts name', function() {
      var client = make();

      client._opts.name = 'client';

      var err = client._err('ok', { name: 'opts' });

      err.message.should.eql('client: opts: ok');
    });
  });

  describe('ext', function() {
    it('should register extension', function() {
      var client = make();

      client._exts.should.be.empty;

      var name = 'test';

      client._ext(name, noop);

      client._exts.should.have.keys(name);
      client._exts[name].should.be.instanceof(Array);
      client._exts[name].should.eql([noop]);

      client._ext(name, noop);

      client._exts[name].should.eql([noop, noop]);
    });

    it('should require an event name', function() {
      (function() {
        make()._ext();
      }).should.throw('extension eventName required');

      (function() {
        make()._ext(true);
      }).should.throw('extension eventName required');
    });

    it('should require callback', function() {
      (function() {
        make()._ext('test');
      }).should.throw('extension callback required');
    });
  });

  describe('plugin', function() {
    it('should register', function(done) {
      var client = make();

      var options = {};
      var plugin = {};

      plugin.register = function(pluginClient, pluginOptions) {
        pluginClient.should.equal(client);
        pluginOptions.should.equal(options);

        done();
      };

      plugin.register.attributes = {
        name: 'test',
        version: '0.0.0',
      };

      client._plugin(plugin, options);
    });

    it('should require plugin option', function() {
      (function() {
        make()._plugin();
      }).should.throw('plugin required');
    });

    it('should require register be a function', function() {
      var plugin = {
        register: {},
      };

      (function() {
        make()._plugin(plugin);
      }).should.throw('plugin must have register function');
    });

    it('should require attributes', function() {
      var plugin = {
        register: function() {},
      };

      (function() {
        make()._plugin(plugin);
      }).should.throw('plugin attributes required');
    });

    it('should require attributes name', function() {
      var plugin = {
        register: function() {},
      };

      plugin.register.attributes = {};

      (function() {
        make()._plugin(plugin);
      }).should.throw('plugin attributes name required');
    });

    it('should require attributes version', function() {
      var plugin = {
        register: function() {},
      };

      plugin.register.attributes = {
        name: 'test',
      };

      (function() {
        make()._plugin(plugin);
      }).should.throw('plugin attributes version required');
    });

    it('should set default options', function(done) {
      var plugin = {
        register: function(client, options) {
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
      var client = make();

      client.on('log', function(tags, data) {
        tags.should.eql(['tag1', 'tag2']);
        data.should.eql('done');

        done();
      });

      client._log(['tag1', 'tag2'], 'done');
    });
  });

  describe('encode', function() {
    it('should throw on unknown encoder', function() {
      (function() {
        make()._encode('fail');
      }).should.throw('unknown encoder: fail');
    });

    it('should throw on invalid content', function() {
      var data = {};
      data[data] = data;

      (function() {
        make()._encode('application/json', data);
      }).should.throw('encode (application/json) failed: ' +
        'Converting circular structure to JSON');
    });
  });

  describe('decode', function() {
    it('should throw on unknown decoder', function() {
      (function() {
        make()._decode('fail');
      }).should.throw('unknown decoder: fail');
    });

    it('should throw on invalid content', function() {
      (function() {
        make()._decode('application/json', '<html>');
      }).should.throw('decode (application/json) failed: Unexpected token <');
    });
  });

  describe('push', function() {
    it('should push method item', function() {
      var ctx = {
        _stack: [],
        opts: { exts: { test: noop } },
      };

      make().__push(ctx, 'test');

      ctx._stack.should.eql([noop]);
    });

    it('should push client and method items', function() {
      var client = make();

      var one = function() {};
      var two = function() {};

      client._ext('test', one);

      var ctx = {
        _stack: [],
        opts: { exts: {} },
      };

      ctx.opts.exts.test = [two];

      client.__push(ctx, 'test');

      ctx._stack.should.eql([one, two]);
    });
  });

  describe('request', function() {
    beforeEach(function() {
      this.client = papi.Client({
        baseUrl: BASE_URL,
        headers: { key: 'value' },
        name: 'testclient',
      });
    });

    it('should not crash with null opts', function(done) {
      this.client._request(null, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: path required');

        done();
      });
    });

    it('should not crash helper methods with null opts', function(done) {
      this.client._get(null, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: path required');

        done();
      });
    });

    it('should emit error when no callback provided', function(done) {
      this.client.on('error', function(err) {
        should.exist(err);

        err.message.should.eql('testclient: callback required');

        done();
      });

      this.client._get('/get');
    });

    it('should require all params', function(done) {
      var req = {
        path: '/one/{two}',
      };

      this.client._get(req, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: missing param: two');

        done();
      });
    });

    it('should handle query encode errors', function(done) {
      var req = {
        path: '/get',
        query: 'fail',
      };

      var mime = 'application/x-www-form-urlencoded';

      this.client._opts.encoders[mime] = function() {
        throw new Error('something went wrong');
      };

      this.client._get(req, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: encode (' + mime + ') ' +
          'failed: something went wrong');

        done();
      });
    });

    it('should handle body encode errors', function(done) {
      var data = {};
      data[data] = data;

      var req = {
        path: '/get',
        type: 'json',
        body: data,
      };

      this.client._post(req, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: encode (application/json) ' +
          'failed: Converting circular structure to JSON');

        done();
      });
    });
  });

  describe('http', function() {
    beforeEach(function() {
      var self = this;

      self.sinon = sinon.sandbox.create();

      function request(type) {
        return function(opts) {
          var req = new events.EventEmitter();

          req.abort = function() {};

          req.setTimeout = function(timeout) {
            self.timeout = timeout;
          };

          req.end = function() {
            self[type] = opts;
          };

          return req;
        };
      }

      self.sinon.stub(http, 'request', request('http'));
      self.sinon.stub(https, 'request', request('https'));
    });

    afterEach(function() {
      this.sinon.restore();
    });

    it('should handle http', function() {
      var self = this;

      var protocol = 'http:';
      var hostname = 'example.org';
      var method = 'GET';

      var baseUrl = protocol + '//' + hostname;

      var client = papi.Client({ baseUrl: baseUrl, timeout: 1000 });

      client._get('/one', noop);

      process.nextTick(function() {
        should(self.http).eql({
          headers: {},
          hostname: hostname,
          method: method,
          path: '/one',
          port: 80,
        });
      });
    });

    it('should handle http explicit', function(done) {
      var self = this;

      var protocol = 'http:';
      var auth = 'user:pass';
      var port = 8000;
      var hostname = 'example.org';
      var method = 'GET';

      var baseUrl = protocol + '//' + auth + '@' + hostname + ':' + port +
        '/one';

      var client = papi.Client({ baseUrl: baseUrl });

      client._get('/two', noop);

      process.nextTick(function() {
        should(self.http).eql({
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
      var self = this;

      var protocol = 'https:';
      var hostname = 'example.org';
      var method = 'GET';

      var baseUrl = protocol + '//' + hostname;

      var client = papi.Client({ baseUrl: baseUrl });

      client._get('/one', noop);

      process.nextTick(function() {
        should(self.https).eql({
          headers: {},
          hostname: hostname,
          method: method,
          path: '/one',
          port: 443,
        });

        done();
      });
    });

    it('should handle https explicit', function(done) {
      var self = this;

      var protocol = 'https:';
      var auth = 'user:pass';
      var port = 4433;
      var hostname = 'example.org';
      var method = 'GET';

      var baseUrl = protocol + '//' + auth + '@' + hostname + ':' + port +
        '/one';

      var client = papi.Client({ baseUrl: baseUrl });

      client._get('/two', noop);

      process.nextTick(function() {
        should(self.https).eql({
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

      this.client = papi.Client({
        baseUrl: this.baseUrl,
        headers: { key: 'value' },
        name: 'testclient',
      });
      this.client.on('log', debug);

      this.nock = nock(this.baseUrl);
    });

    it('should GET text/plain', function(done) {
      this.nock
        .get('/get')
        .reply(200, 'ok', { 'content-type': 'text/plain' });

      this.client._get('/get', function(err, res) {
        should.not.exist(err);

        should.exist(res);
        should(res.body).eql('ok');

        done();
      });
    });

    it('should GET text/html', function(done) {
      this.nock
        .get('/get')
        .reply(200, 'ok', { 'content-type': 'text/html' });

      this.client._get('/get', function(err, res) {
        should.not.exist(err);

        should.exist(res);
        should(res.body).eql('ok');

        done();
      });
    });

    it('should GET application/json', function(done) {
      this.nock
        .get('/get')
        .reply(200,
          JSON.stringify({ is: 'ok' }),
          { 'content-type': 'application/json' }
        );

      this.client._get('/get', function(err, res) {
        should.not.exist(err);

        should.exist(res);
        should(res.body).eql({ is: 'ok' });

        res.statusCode.should.eql(200);

        done();
      });
    });

    it('should return buffer', function(done) {
      this.nock
        .get('/get')
        .reply(200, 'ok');

      this.client._get('/get', function(err, res) {
        should.not.exist(err);

        should.exist(res);
        should.exist(res.body);
        res.body.should.be.instanceof(Buffer);
        res.body.length.should.eql(2);

        res.statusCode.should.eql(200);

        done();
      });
    });

    it('should return buffer for known content-types', function(done) {
      this.nock
        .get('/get')
        .reply(200, { hello: 'world' });

      var opts = {
        path: '/get',
        buffer: true,
      };

      this.client._get(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);
        should.exist(res.body);
        res.body.should.be.instanceof(Buffer);
        res.body.toString().should.eql('{"hello":"world"}');

        res.statusCode.should.eql(200);

        done();
      });
    });

    it('should handle response decode errors', function(done) {
      this.nock
        .get('/get')
        .reply(200, '<html>', { 'content-type': 'application/json' });

      this.client._get('/get', function(err, res) {
        should.exist(err);

        err.message.should.eql('testclient: decode (application/json) ' +
          'failed: Unexpected token <');

        res.body.toString().should.eql('<html>');

        done();
      });
    });

    it('should create request with path replacement', function(done) {
      this.nock
        .get('/hello%20world/0/hello%20world/2/')
        .reply(200);

      var opts = {
        path: '/{saying}/0/{saying}/{count}/',
        params: { saying: 'hello world', count: 2 },
      };

      this.client._get(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);
        res.statusCode.should.eql(200);

        done();
      });
    });

    it('should support unescaped path params', function(done) {
      this.nock
        .get('/hello%2Bworld/')
        .reply(200);

      var opts = {
        path: '/{test}/{extra}',
        params: { extra: null },
      };

      opts.params.test = new Buffer('hello%2Bworld');
      opts.params.test.encode = false;

      this.client._get(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);
        res.statusCode.should.eql(200);

        done();
      });
    });

    it('should create request with query parameters', function(done) {
      this.nock
        .get('/get?one=one&two=two1&two=two2')
        .reply(200);

      var opts = {
        path: '/get',
        query: { one: 'one', two: ['two1', 'two2'] },
      };

      this.client._get(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);
        res.statusCode.should.eql(200);

        done();
      });
    });

    it('should use default headers', function(done) {
      this.nock
        .get('/get')
        .matchHeader('key', 'value')
        .matchHeader('myKey', 'myValue')
        .reply(200);

      var opts = {
        path: '/get',
        headers: { myKey: 'myValue' },
      };

      this.client._get(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should use passed over default headers', function(done) {
      this.nock
        .get('/get')
        .matchHeader('key', 'value')
        .reply(200);

      var opts = {
        path: '/get',
        headers: { key: 'value' },
      };

      this.client._request(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should handle Buffer body', function(done) {
      this.nock
        .post('/post', 'test')
        .matchHeader('content-type', 'custom')
        .matchHeader('content-length', 4)
        .reply(200);

      var opts = {
        path: '/post',
        body: new Buffer('test'),
        headers: { 'content-type': 'custom' },
      };

      this.client._post(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should handle stream.Readable body', function(done) {
      this.nock
        .post('/post', 'test')
        .reply(200);

      var body = new stream.Readable();

      body.push(new Buffer('test'));
      body.push(null);

      var opts = {
        path: '/post',
        body: body,
      };

      this.client._post(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should handle stream.Writable pipe', function(done) {
      this.nock
        .get('/get')
        .reply(200, { hello: 'world' });

      var chunks = [];

      var bodyPipe = new stream.Writable();

      bodyPipe._write = function(chunk, encoding, callback) {
        chunks.push(chunk);

        callback();
      };

      var opts = {
        path: '/get',
        pipe: bodyPipe,
      };

      this.client._get(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        Buffer.concat(chunks).toString().should.eql('{"hello":"world"}');

        done();
      });
    });

    it('should POST application/x-www-form-urlencoded', function(done) {
      this.nock
        .post('/post', 'hello=world')
        .matchHeader('content-type', FORM + '; ' + CHARSET)
        .reply(200);

      var opts = {
        path: '/post',
        type: 'form',
        body: { hello: 'world' },
      };

      this.client._post(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should DELETE', function(done) {
      this.nock
        .delete('/delete')
        .reply(204);

      this.client._delete('/delete', function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should PATCH application/json', function(done) {
      this.nock
        .patch('/patch', { hello: 'world' })
        .reply(204);

      var opts = {
        path: '/patch',
        type: 'json',
        body: { hello: 'world' },
      };

      this.client._patch(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should error for unknown type', function(done) {
      var opts = {
        path: '/patch',
        body: { hello: 'world' },
      };

      this.client._patch(opts, function(err, res) {
        should.exist(err);
        err.message.should.eql('testclient: type required');

        should.not.exist(res);

        done();
      });
    });

    it('should require path', function(done) {
      this.client._request({}, function(err, res) {
        should.exist(err);
        err.message.should.eql('testclient: path required');

        should.not.exist(res);

        done();
      });
    });

    it('should use content-type for type', function(done) {
      this.nock
        .patch('/patch', { hello: 'world' })
        .reply(204);

      var opts = {
        path: '/patch',
        headers: { 'content-type': 'application/json' },
        body: { hello: 'world' },
      };

      this.client._patch(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should return error for non-2xx', function(done) {
      this.nock
        .post('/post')
        .reply(400);

      this.client._post('/post', function(err, res) {
        should.exist(err);
        err.message.should.eql('testclient: bad request');

        should.exist(res);
        res.statusCode.should.eql(400);

        done();
      });
    });

    it('should set err.message to body text', function(done) {
      this.nock
        .post('/post')
        .reply(400, 'validation error', { 'content-type': 'text/plain' });

      this.client._post('/post', function(err, res) {
        should.exist(err);
        err.message.should.eql('testclient: validation error');

        should.exist(res);
        res.statusCode.should.eql(400);

        done();
      });
    });

    it('should set err.message for unknown status codes', function(done) {
      this.nock
        .post('/post')
        .reply(499);

      this.client._post('/post', function(err, res) {
        should.exist(err);
        err.message.should.eql('testclient: request failed: 499');

        should.exist(res);
        res.statusCode.should.eql(499);

        done();
      });
    });

    it('should emit log events', function(done) {
      this.nock
        .post('/post', { name: 'world' })
        .reply(200, { hello: 'world' });

      var events = [];

      this.client._opts.tags = ['class'];
      this.client.on('log', function() {
        events.push(Array.prototype.slice.call(arguments));
      });

      var opts = {
        name: 'method',
        path: '/post',
        body: { name: 'world' },
        type: 'json',
        tags: ['test'],
      };

      this.client._post(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        events.length.should.eql(2);

        events[0][0].should.eql(['papi', 'request', 'test', 'class', 'method']);
        events[0][1].should.eql({
          hostname: 'example.org',
          port: 80,
          path: '/post',
          method: 'POST',
          headers: {
            key: 'value',
            'content-type': 'application/json; charset=utf-8',
            'content-length': 16,
          },
          proto: 'http',
          host: 'example.org:80',
        });

        events[1][0].should.eql(['papi', 'response', 'test', 'class',
                                'method']);
        events[1][1].should.eql({
          statusCode: 200,
          headers: {
            'content-type': 'application/json',
          },
          remoteAddress: undefined,
          remotePort: undefined,
        });

        done();
      });
    });

    it('should call request extensions', function(done) {
      var self = this;

      var called = [];
      var path = '/get';
      var statusCode = 200;

      self.nock
        .get(path)
        .reply(statusCode, { hello: 'world' });

      self.client._ext('onRequest', function(ctx, next) {
        should.exist(ctx);

        called.push('onRequest');

        next();
      });

      self.client._ext('onResponse', function(ctx, next) {
        ctx.should.have.properties('opts', 'state');

        ctx.opts.should.eql({
          headers: {},
          query: {},
          params: {},
          path: path,
          method: 'GET',
          tags: ['testclient'],
        });

        ctx.req.method.should.eql('GET');
        ctx.req.headers.should.eql({ key: 'value' });

        should.not.exist(ctx.err);
        should.exist(ctx.res);

        ctx.res.should.have.properties('statusCode', 'headers', 'body');

        ctx.res.statusCode.should.eql(statusCode);
        ctx.res.headers.should.eql({ 'content-type': 'application/json' });
        ctx.res.body.should.eql({ hello: 'world' });

        called.push('onResponse');

        next();
      });

      self.client._get('/get', function(err, res) {
        should.not.exist(err);

        should.exist(res);

        called.should.eql(['onRequest', 'onResponse']);

        done();
      });
    });

    it('should support retry', function(done) {
      this.nock
        .get('/retry')
        .reply(500, 'error1')
        .get('/retry')
        .reply(503, 'error2')
        .get('/retry')
        .reply(200, { hello: 'world' });

      var responses = [];

      this.client._ext('onResponse', function(ctx, next) {
        responses.push(ctx.res.statusCode);

        if (Math.floor(ctx.res.statusCode / 100) !== 5) return next();

        ctx.retry();
      });

      this.client._get('/retry', function(err, res) {
        should.not.exist(err);
        should.exist(res);

        responses.should.eql([500, 503, 200]);

        done();
      });
    });

    it('should error retry when body is a stream', function(done) {
      this.nock
        .post('/retry', 'test')
        .reply(503);

      this.client._ext('onResponse', function(ctx, next) {
        try {
          ctx.retry();
        } catch (err) {
          next(err);
        }
      });

      var req = {
        path: '/retry',
        body: new stream.Readable(),
      };

      req.body.push(new Buffer('test'));
      req.body.push(null);

      this.client._post(req, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: request is not retryable');

        done();
      });
    });

    it('should retry when body is a function stream', function(done) {
      this.nock
        .post('/retry', 'test')
        .reply(503)
        .post('/retry', 'test')
        .reply(200);

      var responses = [];

      this.client._ext('onResponse', function(ctx, next) {
        responses.push(ctx.res.statusCode);

        if (Math.floor(ctx.res.statusCode / 100) !== 5) return next();

        ctx.retry();
      });

      var body = function() {
        var s = new stream.Readable();
        s.push(new Buffer('test'));
        s.push(null);
        return s;
      };

      var req = {
        path: '/retry',
        body: body,
      };

      this.client._post(req, function(err, res) {
        should.not.exist(err);
        should.exist(res);

        responses.should.eql([503, 200]);

        done();
      });
    });

    it('should error retry when pipe is stream.Writable', function(done) {
      this.nock
        .get('/retry')
        .reply(500);

      this.client._ext('onResponse', function(ctx, next) {
        try {
          ctx.retry();
        } catch (err) {
          next(err);
        }
      });

      var req = {
        path: '/retry',
        pipe: new stream.Writable(),
      };

      this.client._get(req, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: request is not retryable');

        done();
      });
    });

    it('should retry when pipe is a function stream', function(done) {
      this.nock
        .get('/retry')
        .reply(503)
        .get('/retry')
        .reply(200, { hello: 'world' });

      var responses = [];

      this.client._ext('onResponse', function(ctx, next) {
        responses.push(ctx.res.statusCode);

        if (Math.floor(ctx.res.statusCode / 100) !== 5) return next();

        ctx.retry();
      });

      var chunks;

      var pipe = function() {
        chunks = [];

        var bodyPipe = new stream.Writable();

        bodyPipe._write = function(chunk, encoding, callback) {
          chunks.push(chunk);

          callback();
        };

        return bodyPipe;
      };

      var opts = {
        path: '/retry',
        pipe: pipe,
      };

      this.client._get(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        Buffer.concat(chunks).toString().should.eql('{"hello":"world"}');

        responses.should.eql([503, 200]);

        done();
      });
    });

    it('should execute all handlers', function(done) {
      this.nock
        .get('/get')
        .reply(404, 'ok');

      function handleNotFound(ctx, next) {
        if (ctx.res && ctx.res.statusCode === 404) {
          ctx.res.body = undefined;
          delete ctx.err;
        }

        next();
      }

      function check(ctx, next) {
        should.not.exist(ctx.err);

        should.exist(ctx.res);
        should(ctx.res.body).equal(undefined);

        next(false, null, 'world');
      }

      this.client._get('/get', handleNotFound, check, function(err, hello) {
        should.not.exist(err);

        hello.should.eql('world');

        done();
      });
    });

    it('should timeout request', function(done) {
      this.nock
        .get('/get')
        .delayConnection(200)
        .reply(200);

      var opts = {
        path: '/get',
        timeout: 10,
      };

      this.client._get(opts, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: request timed out (10ms)');

        done();
      });
    });
  });
});
