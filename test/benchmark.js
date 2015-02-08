'use strict';

/* jshint expr: true */

/**
 * Module dependencies.
 */

var async = require('async');
var http = require('http');
var request = require('request');
var should = require('should');
var util = require('util');

var papi = require('../lib');

var runner = process.env.BENCHMARK ? describe : describe.skip;

/**
 * Clients
 */

function Test(baseUrl) {
  papi.Client.call(this, { baseUrl: baseUrl });
}

util.inherits(Test, papi.Client);

Test.prototype.test = function(path, callback) {
  this._get({ path: path }, callback);
};

var tests = {};

tests.http = function(test) {
  return function(i, next) {
    var options = {
      hostname: test.address,
      port: test.port,
      path: test.path,
      method: 'GET',
    };

    var req = http.request(options, function(res) {
      var chunks = [];

      res.on('data', function(chunk) {
        chunks.push(chunk);
      });

      res.on('end', function() {
        var body = JSON.parse(Buffer.concat(chunks).toString());
        should.equal(body.hello, 'world');
        next();
      });
    });

    req.on('error', next);
    req.end();
  };
};

tests.papi = function(test) {
  return function(i, next) {
    var client = new Test(test.baseUrl);

    client.test(test.path, function(err, res) {
      if (err) return next(err);

      should.equal(res.body.hello, 'world');

      next();
    });
  };
};

tests.shortcut = function(test) {
  return function(i, next) {
    papi.get(test.url, function(err, res) {
      if (err) return next(err);

      should.equal(res.body.hello, 'world');

      next();
    });
  };
};

tests.request = function(test) {
  return function(i, next) {
    request({ uri: test.url, json: true }, function(err, res) {
      if (err) return next(err);

      should.equal(res.body.hello, 'world');

      next();
    });
  };
};

function run(opts, next) {
  var start = new Date();

  if (!opts.count) opts.count = 10000;

  async.times(opts.count, opts.test, function(err) {
    if (err) throw err;

    var duration = new Date() - start;
    var perSecond = opts.count / (duration / 1000);

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
    var self = this;

    self.server = http.createServer(function(req, res) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
      });

      res.end('{"hello":"world"}');
    });

    self.server.listen(0, function(err) {
      if (err) return done(err);

      var addr = self.server.address();

      self.address = addr.address;
      self.port = addr.port;
      self.baseUrl = 'http://' + addr.address + ':' + addr.port;
      self.path = '/test';
      self.url = self.baseUrl + self.path;

      done();
    });
  });

  after(function(done) {
    this.server.close(done);
  });

  it('should be ok', function(done) {
    var self = this;

    var jobs = [];

    jobs.push(function(next) {
      run({ name: 'Http', test: tests.http(self) }, next);
    });

    jobs.push(function(next) {
      run({ name: 'Papi', test: tests.papi(self) }, next);
    });

    jobs.push(function(next) {
      run({ name: 'Shortcut', test: tests.shortcut(self) }, next);
    });

    jobs.push(function(next) {
      run({ name: 'Request', test: tests.request(self) }, next);
    });

    async.series(jobs, function(err, results) {
      var data = {};

      console.log();
      console.log('    Name\t\tRate (req/s)\tDuration (ms)\tCount\tSlower');

      var http = results[0];

      results.forEach(function(r) {
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

      data.papi.duration.should.be.below(data.http.duration * 2);
      data.shortcut.duration.should.be.below(data.http.duration * 2);

      done();
    });
  });
});
