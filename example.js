'use strict';

const papi = require('./lib');

/**
 * GitHub API client
 */
class GitHub extends papi.Client {
  constructor(opts) {
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
      opts.headers['user-agent'] = 'PapiGitHub/0.1.0';
    }
    if (opts.tags) {
      opts.tags = ['github'].concat(opts.tags);
    } else {
      opts.tags = ['github'];
    }
    if (!opts.timeout) {
      opts.timeout = 60 * 1000;
    }

    super(opts);

    if (opts.debug) {
      this.on('log', console.log);
    }
  }

  /**
   * Get user gists
   */
  async gists(username) {
    const opts = {
      path: '/users/{username}/gists',
      params: { username: username },
    };

    const res = await this._get(opts);
    return res.body;
  }
}

// Print gists for user `silas`
async function main() {
  const github = new GitHub({ debug: true });

  const gists = await github.gists('silas');

  console.log('----');

  gists.forEach(function(gist) {
    if (gist.description) console.log(gist.description);
  });
}

if (require.main === module) {
  main();
} else {
  module.exports = GitHub;
}
