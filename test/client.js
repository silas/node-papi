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
var utils = require('../lib/utils');

/**
 * Tests
 */

var FORM = 'application/x-www-form-urlencoded';
var CHARSET = 'charset=utf-8';

/**
 * Tests
 */

describe('Client', function() {
  describe('request', function() {
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
      });
      this.client.on('log', debug);

      var opts;
      var path;

      this.client._ext('onCreate', function(ctx, next) {
        opts = lodash.cloneDeep(ctx.opts);
        path = ctx.path;

        next();
      });

      this.client._ext('onResponse', function(ctx, next) {
        opts.should.eql(ctx.opts);
        path.should.eql(ctx.path);

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
        path: { saying: 'hello world', count: 2 },
      };
      var path = '/{saying}/0/{saying}/{count}/';

      this.client._get(path, opts, function(err, res) {
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
        query: { one: 'one', two: ['two1', 'two2'] },
      };

      this.client._get('/get', opts, function(err, res) {
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
        headers: { myKey: 'myValue' },
      };

      this.client._get('/get', opts, function(err, res) {
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
        headers: { key: 'value' },
      };

      this.client._request('/get', opts, function(err, res) {
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
        type: 'form',
        body: { hello: 'world' },
      };

      this.client._post('/post', opts, function(err, res) {
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
        type: 'json',
        body: { hello: 'world' },
      };

      this.client._patch('/patch', opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should error for unknown type', function(done) {
      var opts = {
        body: { hello: 'world' },
      };

      this.client._patch('/patch', opts, function(err, res) {
        should.exist(err);
        err.message.should.eql('type required');

        should.not.exist(res);

        done();
      });
    });

    it('should require path', function(done) {
      this.client._request(null, {}, function(err, res) {
        should.exist(err);
        err.message.should.eql('path required');

        should.not.exist(res);

        done();
      });
    });

    it('should use content-type for type', function(done) {
      this.nock
        .patch('/patch', { hello: 'world' })
        .reply(204);

      var opts = {
        headers: { 'content-type': 'application/json' },
        body: { hello: 'world' },
      };

      this.client._patch('/patch', opts, function(err, res) {
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
        err.message.should.eql('Bad Request');

        should.exist(res);
        res.statusCode.should.eql(400);

        done();
      });
    });

    it('should set err.message to body text', function(done) {
      this.nock
        .post('/post')
        .reply(400, 'Validation error', { 'content-type': 'text/plain' });

      this.client._post('/post', function(err, res) {
        should.exist(err);
        err.message.should.eql('Validation error');

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
        err.message.should.eql('Request failed: 499');

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
      this.client.on('log', function(e) { events.push(e); });

      var opts = {
        body: { name: 'world' },
        type: 'json',
        tags: ['func'],
      };

      this.client._post('/post', opts, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        events.length.should.eql(4);

        events[0].tags.should.eql([
          'class',
          'debug',
          'options',
          'request',
          'func',
        ]);

        var keys = Object.keys(events[0].data[0]).filter(function(key) {
          return key !== 'body';
        });

        utils.pick(events[0].data[0], keys).should.eql({
          hostname: 'example.org',
          port: 80,
          path: '/post',
          method: 'POST',
          headers: {
            key: 'value',
            'content-length': 16,
            'content-type': 'application/json; charset=utf-8',
          },
          proto: 'http',
          host: 'example.org:80',
        });

        events[1].tags.should.eql([
          'class',
          'debug',
          'response',
          'statusCode',
          'func',
        ]);
        events[1].data[0].should.eql(200);

        events[2].tags.should.eql([
          'class',
          'debug',
          'response',
          'headers',
          'func',
        ]);
        events[2].data[0].should.eql({
          'content-type': 'application/json'
        });

        events[3].tags.should.eql([
          'class',
          'body',
          'debug',
          'response',
          'func',
        ]);
        events[3].data[0].toString().should.eql('{"hello":"world"}');
        events[3].data[0].should.be.instanceof(Buffer);

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
        ctx.should.have.keys('path', 'opts');

        ctx.path.should.eql(path);
        ctx.opts.should.eql({ method: 'GET' });

        ctx.start = new Date();

        called.push('onCreate');

        next();
      });

      self.client._ext('onRequest', function(ctx, next) {
        called.push('onRequest');

        next();
      });

      self.client._ext('onResponse', function(ctx, next) {
        ctx.should.have.properties('path', 'opts', 'start');

        ctx.path.should.eql(path);
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

        ctx.should.have.properties('path', 'opts', 'callback');

        ctx.callback.should.equal(callback);

        ctx.callback = function(err, res) {
          should.not.exist(err);
          should.exist(res);

          done();
        };

        return 'custom';
      });

      self.client._get('/get', callback).should.eql('custom');
    });
  });
});
