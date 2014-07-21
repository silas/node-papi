'use strict';

/**
 * Module dependencies.
 */

var debug = require('debug')('rapi');
var events = require('events');
var http = require('http');
var https = require('https');
var lodash = require('lodash');
var nock = require('nock');
var should = require('should');
var sinon = require('sinon');

var rapi = require('../lib');

/**
 * Tests
 */

var FORM = 'application/x-www-form-urlencoded';
var CHARSET = 'charset=utf-8';

/**
 * Tests
 */

describe('Client', function() {
  describe('err', function() {
    beforeEach(function() {
      this.client = rapi.Client('http://example.org');
    });

    it('should return nothing', function() {
      should.not.exist(this.client.__err());
    });

    it('should convert string to error', function() {
      var err = this.client.__err('test');

      should(err).be.instanceof(Error);

      err.message.should.eql('test');
    });

    it('should not change error', function() {
      var message = 'ok';

      var err1 = new Error(message);
      var err2 = this.client.__err(err1);

      should(err2).be.instanceof(Error);
      err2.should.equal(err1);
      err2.message.should.eql(message);
    });

    it('should add client name', function() {
      this.client._opts.name = 'client';

      var err = this.client.__err('ok');

      err.message.should.eql('client: ok');
    });

    it('should add opts name', function() {
      var opts = { name: 'opts' };

      var err = this.client.__err('ok', opts);

      err.message.should.eql('opts: ok');
    });

    it('should add client and opts name', function() {
      this.client._opts.name = 'client';
      var opts = { name: 'opts' };

      var err = this.client.__err('ok', opts);

      err.message.should.eql('client: opts: ok');
    });
  });

  describe('plugin', function() {
    it('should register', function(done) {
      var client = rapi.Client('http://example.org');
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

      var client = rapi.Client({ baseUrl: baseUrl, timeout: 1000 });

      client._get('/one');

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

      var client = rapi.Client({ baseUrl: baseUrl });

      client._get('/two');

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

      var client = rapi.Client({ baseUrl: baseUrl });

      client._get('/one');

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

      var client = rapi.Client({ baseUrl: baseUrl });

      client._get('/two');

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

  describe('request', function() {
    before(function() {
      nock.disableNetConnect();
    });

    after(function() {
      nock.enableNetConnect();
    });

    beforeEach(function() {
      this.baseUrl = 'http://example.org';

      this.client = rapi.Client({
        baseUrl: this.baseUrl,
        headers: { key: 'value' },
        name: 'testclient',
      });
      this.client.on('log', debug);

      var opts;

      this.client._ext('onCreate', function(ctx, next) {
        opts = lodash.cloneDeep(ctx.opts);

        next();
      });

      this.client._ext('onResponse', function(ctx, next) {
        opts.should.eql(ctx.opts);

        next();
      });

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
        path: '/post',
        body: { name: 'world' },
        type: 'json',
        tags: ['test'],
      };

      this.client._post(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        events.length.should.eql(2);

        events[0][0].should.eql(['debug', 'request', 'test']);
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

        events[1][0].should.eql(['debug', 'response', 'test']);
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

      self.client._ext('onCreate', function(ctx, next) {
        ctx.should.have.keys('opts', 'state', 'retry');

        ctx.opts.should.eql({
          headers: {},
          query: {},
          params: {},
          path: path,
          method: 'GET',
        });

        ctx.start = new Date();

        called.push('onCreate');

        next();
      });

      self.client._ext('onRequest', function(ctx, next) {
        called.push('onRequest');

        next();
      });

      self.client._ext('onResponse', function(ctx, next) {
        ctx.should.have.properties('opts', 'start');

        ctx.opts.should.eql({
          headers: {},
          query: {},
          params: {},
          path: path,
          method: 'GET',
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

        called.should.eql(['onCreate', 'onRequest', 'onResponse']);

        done();
      });
    });

    it('should allow user to set return value', function(done) {
      var self = this;

      var path = '/get';
      var statusCode = 200;

      self.nock
        .get(path)
        .reply(statusCode, { hello: 'world' });

      var callback = function() {};

      self.client._ext('onReturn', function(ctx, result) {
        if (result) {
          throw new Error('onReturn already registered');
        }

        ctx.should.have.properties('opts', 'callback');

        ctx.callback.should.equal(callback);

        ctx.callback = function(err, res) {
          should.not.exist(err);
          should.exist(res);

          done();
        };

        return 'custom';
      });

      self.client._get(path, callback).should.eql('custom');
    });

    it('should call options', function(done) {
      var opts = {
        path: '/get',
        name: 'testoptions',
        params: { hello: 'world' },
      };

      opts.options = function() {
        this.should.have.keys(
          'method',
          'name',
          'params',
          'query',
          'headers',
          'path',
          'options'
        );

        this.path.should.eql('/get');
        this.params.should.eql({ hello: 'world' });

        throw new Error('hello world');
      };

      this.client._get(opts, function(err) {
        should.exist(err);

        err.message.should.eql('testclient: testoptions: hello world');

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

    it('should format response', function(done) {
      this.nock
        .get('/get')
        .reply(404, 'ok');

      var opts = {
        path: '/get',
        format: [
          function(args) {
            var res = args[1];

            if (res && res.statusCode === 404) {
              res.body = undefined;

              args.set(null, res);
            }
          },
        ],
      };

      this.client._get(opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);
        should(res.body).equal(undefined);

        done();
      });
    });
  });
});
