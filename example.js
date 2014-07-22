'use strict';

/**
 * Module dependencies.
 */

var rapi = require('./lib');
var util = require('util');

/**
 * GitHub API client
 */

function GitHub(opts) {
  opts = opts || {};

  if (!opts.baseUrl) {
    opts.baseUrl = 'https://api.github.com';
  }
  if (!opts.headers) {
    opts.headers = {};
  }
  if (!opts.headers.accept) {
    opts.headers.accept = 'application/vnd.github.v3+json';
  }
  if (!opts.headers['user-agent']) {
    opts.headers['user-agent'] = 'RapiGitHub/0.1.0';
  }
  if (opts.tags) {
    opts.tags = ['github'].concat(opts.tags);
  } else {
    opts.tags = ['github'];
  }
  if (!opts.timeout) {
    opts.timeout = 60 * 1000;
  }

  rapi.Client.call(this, opts);

  if (opts.debug) {
    this.on('log', console.log);
  }
}

util.inherits(GitHub, rapi.Client);

/**
 * Get user gists
 */

GitHub.prototype.gists = function(username, callback) {
  var opts = {
    path: '/users/{username}/gists',
    params: { username: username },
  };

  return this._get(opts, callback);
};

/**
 * Print gists for user `silas`
 */

function main() {
  var github = new GitHub({ debug: true });

  github.gists('silas', function(err, res) {
    if (err) throw err;

    console.log('----');

    res.body.forEach(function(gist) {
      if (gist.description) console.log(gist.description);
    });
  });
}

/**
 * Initialize
 */

if (require.main === module) {
  main();
} else {
  module.exports = GitHub;
}
