'use strict';

/**
 * Module dependencies.
 */

var debug = require('debug')('rapi');
var events = require('events');
var http = require('http');
var https = require('https');
var nock = require('nock');
var should = require('should');
var sinon = require('sinon');

var Rapi = require('../lib').Rapi;

/**
 * Tests
 */

var FORM = 'application/x-www-form-urlencoded';
var CHARSET = 'charset=utf-8';

/**
 * Tests
 */

describe('Rapi', function() {
  describe('request', function() {
    beforeEach(function() {
      var self = this;

      self.sinon = sinon.sandbox.create();

      function request(type) {
        return function(opts) {
          var req = new events.EventEmitter();

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
      var protocol = 'http:';
      var hostname = 'example.org';
      var method = 'GET';

      var baseUrl = protocol + '//' + hostname;

      var rapi = new Rapi({ baseUrl: baseUrl, timeout: 1000 });

      rapi.request({ method: method, path: '/one' });

      should(this.http).eql({
        hostname: hostname,
        method: method,
        path: '/one',
        port: 80,
      });
    });

    it('should handle http explicit', function() {
      var protocol = 'http:';
      var auth = 'user:pass';
      var port = 8000;
      var hostname = 'example.org';
      var method = 'GET';

      var baseUrl = protocol + '//' + auth + '@' + hostname + ':' + port +
                    '/one';

      var rapi = new Rapi({ baseUrl: baseUrl });

      rapi.request({ method: method, path: '/two' });

      should(this.http).eql({
        auth: auth,
        hostname: hostname,
        method: method,
        path: '/one/two',
        port: port,
      });

    });

    it('should handle https', function() {
      var protocol = 'https:';
      var hostname = 'example.org';
      var method = 'GET';

      var baseUrl = protocol + '//' + hostname;

      var rapi = new Rapi({ baseUrl: baseUrl });

      rapi.request({ method: method, path: '/one' });

      should(this.https).eql({
        hostname: hostname,
        method: method,
        path: '/one',
        port: 443,
      });
    });

    it('should handle https explicit', function() {
      var protocol = 'https:';
      var auth = 'user:pass';
      var port = 4433;
      var hostname = 'example.org';
      var method = 'GET';

      var baseUrl = protocol + '//' + auth + '@' + hostname + ':' + port +
                    '/one';

      var rapi = new Rapi({ baseUrl: baseUrl });

      rapi.request({ method: method, path: '/two' });

      should(this.https).eql({
        auth: auth,
        hostname: hostname,
        method: method,
        path: '/one/two',
        port: port,
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

      this.rapi = new Rapi({
        baseUrl: this.baseUrl,
        headers: { key: 'value' },
      });
      this.rapi.on('debug', debug);

      this.nock = nock(this.baseUrl);
    });

    it('should GET text/plain', function(done) {
      this.nock
        .get('/get')
        .reply(200, 'ok', { 'content-type': 'text/plain' });

      var req = {
        method: 'GET',
        path: '/get',
      };

      this.rapi.request(req, function(err, res) {
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

      var req = {
        method: 'GET',
        path: '/get',
      };

      this.rapi.request(req, function(err, res) {
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

      var req = {
        method: 'GET',
        path: '/get',
      };

      this.rapi.request(req, function(err, res) {
        should.not.exist(err);

        should.exist(res);
        should.exist(res.body);
        res.body.should.be.instanceof(Buffer);
        res.body.length.should.eql(2);

        res.statusCode.should.eql(200);

        done();
      });
    });

    it('should create request with query parameters', function(done) {
      this.nock
        .get('/get?one=one&two=two1&two=two2')
        .reply(200);

      var req = {
        method: 'GET',
        path: '/get',
        query: { one: 'one', two: ['two1', 'two2'] },
      };

      this.rapi.request(req, function(err, res) {
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

      var req = {
        method: 'GET',
        path: '/get',
        headers: { myKey: 'myValue' },
      };

      this.rapi.request(req, function(err, res) {
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

      var req = {
        method: 'GET',
        path: '/get',
        headers: { key: 'value' },
      };

      this.rapi.request(req, function(err, res) {
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

      var req = {
        method: 'POST',
        path: '/post',
        type: 'form',
        body: { hello: 'world' },
      };

      this.rapi.request(req, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should DELETE', function(done) {
      this.nock
        .delete('/delete')
        .reply(204);

      var req = {
        method: 'DELETE',
        path: '/delete',
      };

      this.rapi.request(req, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should PATCH application/json', function(done) {
      this.nock
        .patch('/patch', { hello: 'world' })
        .reply(204);

      var req = {
        method: 'PATCH',
        path: '/patch',
        type: 'json',
        body: { hello: 'world' },
      };

      this.rapi.request(req, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should error for unknown type', function(done) {
      var req = {
        method: 'PATCH',
        path: '/patch',
        body: { hello: 'world' },
      };

      this.rapi.request(req, function(err, res) {
        should.exist(err);
        err.message.should.eql('type required');

        should.not.exist(res);

        done();
      });
    });

    it('should require path', function(done) {
      var req = {
        method: 'GET',
      };

      this.rapi.request(req, function(err, res) {
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

      var req = {
        method: 'PATCH',
        path: '/patch',
        headers: { 'content-type': 'application/json' },
        body: { hello: 'world' },
      };

      this.rapi.request(req, function(err, res) {
        should.not.exist(err);

        should.exist(res);

        done();
      });
    });

    it('should return error for non-2xx', function(done) {
      this.nock
        .post('/post')
        .reply(400);

      var req = {
        method: 'POST',
        path: '/post',
      };

      this.rapi.request(req, function(err, res) {
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

      var req = {
        method: 'POST',
        path: '/post',
      };

      this.rapi.request(req, function(err, res) {
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

      var req = {
        method: 'POST',
        path: '/post',
      };

      this.rapi.request(req, function(err, res) {
        should.exist(err);
        err.message.should.eql('Request failed: 499');

        should.exist(res);
        res.statusCode.should.eql(499);

        done();
      });
    });
  });
});
