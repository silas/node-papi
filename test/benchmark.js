'use strict';

/* jshint expr: true */

const async = require('async');
const http = require('http');
const request = require('request');
const should = require('should');
const util = require('util');

const papi = require('../lib');

const runner = process.env.BENCHMARK ? describe : describe.skip;

/**
 * Clients
 */

class Test extends papi.Client {
  constructor(baseUrl) {
    super({ baseUrl: baseUrl });
  }

  test(path) {
    return this._get({ path: path });
  }
}

const tests = {};

tests.http = test => {
  return (i, next) => {
    const options = {
      hostname: test.address,
      port: test.port,
      path: test.path,
      method: 'GET',
    };

    const req = http.request(options, res => {
      const chunks = [];

      res.on('data', chunk => chunks.push(chunk));

      res.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        should.equal(body.hello, 'world');
        next();
      });
    });

    req.on('error', next);
    req.end();
  };
};

tests.papi = test => {
  return (i, next) => {
    const client = new Test(test.baseUrl);

    client.test(test.path).then(res => {
      should.equal(res.body.hello, 'world');
      next();
    }, next);
  };
};

tests.shortcut = test => {
  return (i, next) => {
    papi.get(test.url).then(res => {
      should.equal(res.body.hello, 'world');
      next();
    }).catch(next);
  };
};

tests.request = test => {
  return (i, next) => {
    request({ uri: test.url, json: true }, (err, res) => {
      if (err) return next(err);

      should.equal(res.body.hello, 'world');

      next();
    });
  };
};

function run(opts, next) {
  const start = new Date();

  if (!opts.count) opts.count = 10000;

  async.times(opts.count, opts.test, err => {
    if (err) return next(err);

    const duration = new Date() - start;
    let perSecond = opts.count / (duration / 1000);

    perSecond = parseInt(perSecond * 100, 10) / 100;

    next(null, {
      name: opts.name,
      perSecond: perSecond,
      duration: duration,
      count: opts.count,
    });
  });
}

/**
 * Tests
 */

runner('Performance', function() {
  this.timeout(30 * 1000);

  before(function(done) {
    this.server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/json',
      });

      res.end('{"hello":"world"}');
    });

    this.server.listen(0, err => {
      if (err) return done(err);

      const addr = this.server.address();

      let hostname = addr.address;
      if (addr.family === 'IPv6') hostname = '[' + hostname + ']';

      this.address = addr.address;
      this.port = addr.port;
      this.baseUrl = 'http://' + hostname + ':' + addr.port;
      this.path = '/test';
      this.url = this.baseUrl + this.path;

      done();
    });
  });

  after(function(done) {
    this.server.close(done);
  });

  it('should be ok', function(done) {
    const jobs = [];

    jobs.push(next => run({ name: 'Http', test: tests.http(this) }, next));
    jobs.push(next => run({ name: 'Papi', test: tests.papi(this) }, next));
    jobs.push(next =>
      run({ name: 'Shortcut', test: tests.shortcut(this) }, next));
    jobs.push(next =>
      run({ name: 'Request', test: tests.request(this) }, next));

    async.series(jobs, (err, results) => {
      if (err) return done(err);

      const data = {};

      console.log();
      console.log('    Name\t\tRate (req/s)\tDuration (ms)\tCount\tSlower');

      const http = results[0];

      results.forEach(r => {
        data[r.name.toLowerCase()] = r;

        console.log(util.format('    %s\t\t%s\t\t%s\t\t%s\t%sx',
          r.name,
          r.perSecond,
          r.duration,
          r.count,
          (r.duration / http.duration).toFixed(1)
        ));
      });

      console.log();

      should(data.papi.duration).be.below(data.http.duration * 2);
      should(data.shortcut.duration).be.below(data.http.duration * 2);

      done();
    });
  });
});
