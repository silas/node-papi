'use strict';

/* jshint expr: true */

/**
 * Module dependencies.
 */

var nock = require('nock');
var should = require('should');

var papi = require('../lib');

/**
 * Tests
 */

describe('Shortcuts', function() {
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

  it('should throw when no callback provided', function() {
    (function() {
      papi.request();
    }).should.throw('no callback: url required');
  });

  it('should require url', function(done) {
    papi.request(null, function(err) {
      should.exist(err);

      err.message.should.eql('url required');

      done();
    });
  });

  it('should require url to be string', function(done) {
    papi.request({ url: true }, function(err) {
      should.exist(err);

      err.message.should.eql('url must be a string');

      done();
    });
  });

  it('should make request', function(done) {
    this.nock
      .get('/test')
      .reply(200);

    var opts = {
      method: 'get',
      url: this.baseUrl + '/test',
    };

    papi.request(opts, function(err, res) {
      should.not.exist(err);

      res.statusCode.should.eql(200);

      done();
    });
  });

  it('should make request with string url', function(done) {
    this.nock
      .get('/test')
      .reply(200);

    papi.request(this.baseUrl + '/test', function(err, res) {
      should.not.exist(err);

      res.statusCode.should.eql(200);

      done();
    });
  });

  it('should make request with middleware', function(done) {
    this.nock
      .get('/test')
      .reply(200);

    var opts = {
      method: 'get',
      url: this.baseUrl + '/test',
    };

    var ok = {};

    var one = function(ctx, next) {
      ok.one = true;

      next();
    };

    var two = function(ctx, next) {
      ok.two = true;

      next();
    };

    papi.request(opts, one, two, function(err, res) {
      should.not.exist(err);

      res.statusCode.should.eql(200);

      ok.should.eql({ one: true, two: true });

      done();
    });
  });

  it('should make get request', function(done) {
    this.nock
      .get('/get')
      .reply(200,
        JSON.stringify({ is: 'ok' }),
        { 'content-type': 'application/json' }
      );

    var opts = {
      url: this.baseUrl + '/get',
    };

    papi.get(opts, function(err, res) {
      should.not.exist(err);

      should.exist(res);
      should(res.body).eql({ is: 'ok' });

      res.statusCode.should.eql(200);

      done();
    });
  });

  it('should require url in method calls', function(done) {
    papi.get(null, function(err) {
      should.exist(err);

      err.message.should.eql('url required');

      done();
    });
  });

  it('should use middleware in method calls', function(done) {
    this.nock
      .get('/test')
      .reply(200);

    var ok = {};

    var one = function(ctx, next) {
      ok.one = true;

      next();
    };

    var two = function(ctx, next) {
      ok.two = true;

      next();
    };

    papi.get(this.baseUrl + '/test', one, two, function(err, res) {
      should.not.exist(err);

      res.statusCode.should.eql(200);

      ok.should.eql({ one: true, two: true });

      done();
    });
  });

  it('should make head request', function(done) {
    this.nock
      .head('/head')
      .reply(200);

    papi.head(this.baseUrl + '/head', function(err, res) {
      should.not.exist(err);

      should.exist(res);

      res.statusCode.should.eql(200);

      done();
    });
  });

  it('should make post request', function(done) {
    this.nock
      .post('/post', { hello: 'world' })
      .reply(200);

    var opts = {
      url: this.baseUrl + '/post',
      type: 'form',
      body: { hello: 'world' },
    };

    papi.post(opts, function(err, res) {
      should.not.exist(err);

      res.statusCode.should.eql(200);

      done();
    });
  });

  it('should make put request', function(done) {
    this.nock
      .put('/put', { hello: 'world' })
      .reply(200);

    var opts = {
      url: this.baseUrl + '/put',
      type: 'json',
      body: { hello: 'world' },
    };

    papi.put(opts, function(err, res) {
      should.not.exist(err);

      res.statusCode.should.eql(200);

      done();
    });
  });

  it('should make delete request', function(done) {
    this.nock
      .delete('/delete')
      .reply(200);

    papi.del(this.baseUrl + '/delete', function(err, res) {
      should.not.exist(err);

      res.statusCode.should.eql(200);

      done();
    });
  });

  it('should make patch request', function(done) {
    this.nock
      .patch('/patch', { hello: 'world' })
      .reply(200);

    var opts = {
      url: this.baseUrl + '/patch',
      type: 'json',
      body: { hello: 'world' },
    };

    papi.patch(opts, function(err, res) {
      should.not.exist(err);

      res.statusCode.should.eql(200);

      done();
    });
  });
});
