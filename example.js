'use strict';

/**
 * Module dependencies.
 */

var Rapi = require('./lib').Rapi;
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

  Rapi.call(this, opts);
}

util.inherits(GitHub, Rapi);

/**
 * Get user gists
 */

GitHub.prototype.gists = function(username, callback) {
  var opts = {
    path: { username: username },
  };

  this._get('/users/{username}/gists', opts, function(err, res) {
    if (err) {
      if (res && res.statusCode === 404) {
        err.message = 'User "' + username + '" not found';
      }

      return callback(err);
    }

    callback(null, res.body);
  });
};

/**
 * Print gists for user `silas`
 */

function main() {
  var github = new GitHub();

  github.gists('silas', function(err, gists) {
    if (err) throw err;

    gists.forEach(function(gist) {
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
