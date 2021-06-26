'use strict';

/* jshint expr: true */

const nock = require('nock');
const should = require('should');

const papi = require('../lib');

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

  it('should require url', function() {
    return should(papi.request()).rejectedWith('url required');
  });

  it('should require url to be string', function() {
    return should(papi.request({ url: true }))
      .rejectedWith('url must be a string');
  });

  it('should make request', async function() {
    this.nock
      .get('/test/world')
      .reply(200);

    const opts = {
      method: 'get',
      url: this.baseUrl + '/test/{hello}',
      params: { hello: 'world' },
    };

    const res = await papi.request(opts);
    should(res).have.property('statusCode', 200);
  });

  it('should make request with string url', async function() {
    this.nock
      .get('/test')
      .reply(200);

    const res = await papi.request(this.baseUrl + '/test');
    should(res).have.property('statusCode', 200);
  });

  it('should make request with URL', async function() {
    this.nock
        .get('/test')
        .reply(200);

    const res = await papi.request(new URL('/test', this.baseUrl));
    should(res).have.property('statusCode', 200);
  });

  it('should make request with middleware', async function() {
    this.nock
      .get('/test')
      .reply(200);

    const opts = {
      method: 'get',
      url: this.baseUrl + '/test',
    };

    const ok = {};

    const one = (request, next) => {
      ok.one = true;

      next();
    };

    const two = (request, next) => {
      ok.two = true;

      next();
    };

    const res = await papi.request(opts, one, two);
    should(res).have.property('statusCode', 200);

    should(ok).eql({ one: true, two: true });
  });

  it('should make get request', async function() {
    this.nock
      .get('/get')
      .reply(200,
        JSON.stringify({ is: 'ok' }),
        { 'content-type': 'application/json' }
      );

    const opts = {
      url: this.baseUrl + '/get',
    };

    const res = await papi.get(opts);
    should(res).have.property('statusCode', 200);
    should(res.body).eql({ is: 'ok' });
  });

  it('should require url in method calls', function() {
    return should(papi.get()).rejectedWith('url required');
  });

  it('should use middleware in method calls', async function() {
    this.nock
      .get('/test')
      .reply(200);

    const ok = {};

    const one = (request, next) => {
      ok.one = true;

      next();
    };

    const two = (request, next) => {
      ok.two = true;

      next();
    };

    const res = await papi.get(this.baseUrl + '/test', one, two);
    should(res).have.property('statusCode', 200);

    should(ok).eql({ one: true, two: true });
  });

  it('should make head request', async function() {
    this.nock
      .head('/head')
      .reply(200);

    const res = await papi.head(this.baseUrl + '/head');
    should(res).have.property('statusCode', 200);
  });

  it('should make post request', async function() {
    this.nock
      .post('/post', { hello: 'world' })
      .reply(200);

    const opts = {
      url: this.baseUrl + '/post',
      type: 'form',
      body: { hello: 'world' },
    };

    const res = await papi.post(opts);
    should(res).have.property('statusCode', 200);
  });

  it('should make put request', async function() {
    this.nock
      .put('/put', { hello: 'world' })
      .reply(200);

    const opts = {
      url: this.baseUrl + '/put',
      type: 'json',
      body: { hello: 'world' },
    };

    const res = await papi.put(opts);
    should(res).have.property('statusCode', 200);
  });

  it('should make delete request', async function() {
    this.nock
      .delete('/delete')
      .reply(200);

    const res = await papi.del(this.baseUrl + '/delete');
    should(res).have.property('statusCode', 200);
  });

  it('should make patch request', async function() {
    this.nock
      .patch('/patch', { hello: 'world' })
      .reply(200);

    const opts = {
      url: this.baseUrl + '/patch',
      type: 'json',
      body: { hello: 'world' },
    };

    const res = await papi.patch(opts);
    should(res).have.property('statusCode', 200);
  });
});
