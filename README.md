# Rapi [![Build Status](https://travis-ci.org/silas/node-rapi.png?branch=master)](https://travis-ci.org/silas/node-rapi)

This is a module for building HTTP API clients.

 * [Documentation](#documentation)
 * [Example](#example)
 * [License](#license)

## Documentation

### rapi.Client([options])

Initialize a new client.

Options

 * baseUrl (String): base URL, should not include trailing slash
 * headers (Object\<String, String>, optional): headers to include in every request
 * type (String, optional, supports: form, json, text): default request body encoding type
 * encoders (Object\<String, Function>, optional): an object that maps a mime type to a function. The function should accept an object and return a Buffer.
 * decoders (Object\<String, Function>, optional): an object that maps a mime type to a function. The function should accept a Buffer or String (must support both) and return an object.
 * tags (String[], optional): tags included in `_log` calls
 * timeout (Number, optional): default number of milliseconds before request is aborted

Usage

``` javascript
var rapi = require('rapi');

var client = new rapi.Client({
  baseUrl: 'https://api.github.com',
  headers: { 'user-agent': 'RapiGitHub/0.1.0' },
  timeout: 5 * 1000,
});
```

### client.\_request(path, options, callback)

Make an HTTP request.

Arguments

 * path (String): HTTP path, can include variable segments defined by curly braces (ex: `/user/{id}`)
 * callback (Function\<err, res>): request callback function

Options

 * method (String): HTTP method
 * headers (Object\<String, String>, optional): HTTP headers to include in request
 * path (Object\<String, String>, optional): replaces variables in request path
 * query (Object\<String, String|String[]>, optional): HTTP query parameters
 * body (Object, optional): request body
 * type (String, optional, supports: form, json, text): request body encoding type
 * timeout (Number, optional): number of milliseconds before request is aborted
 * tags (String[], optional): tags included in `_log` calls

There are also `_get`, `_head`, `_post`, `_put`, `_delete`, `_patch`, and
`_options` shortcuts with the same method signature as `_request`.

Usage

``` javascript
var opts = {
  path: { username: 'silas' },
};

client._get('/users/{username}/gists', opts, function(err, res) {
  if (err) {
    console.log('error', err.message);
  }

  if (res) {
    console.log('statusCode', res.statusCode);
    console.log('body', res.body);
  }
});
```

Result

```
statusCode 200
body [ { url: 'https://api.github.com/gists/9458207',
...
```

### client.\_log(tags, [data...])

Emit log events.

Arguments

 * tags (String[]): tags associated with event
 * data (optional): remaining arguments are added to data attribute

Usage

``` javascript
client.on('log', console.log);

client._log(['github', 'test'], 'one', 'two');
```

Result

```
{ data: [ 'one', 'two' ], tags: [ 'github', 'test' ] }
```

### client.\_before(ctx, next)

Called before request is sent.

Arguments

 * ctx (Object): object containing `path` and `opts`.
 * next (Function): continue processing request

Usage

``` javascript
client._before = function(ctx, next) {
  console.log('path', ctx.path);
  console.log('opts', ctx.opts);

  ctx.start = new Date();

  next();
};
```

### client.\_after(ctx, next)

Called after request finishes.

Arguments

 * ctx (Object): object containing `path`, `opts`, and `args`.
 * next (Function): continue processing request

Usage

``` javascript
client._after = function(ctx, next) {
  console.log('path', ctx.path);
  console.log('elapsed', new Date() - ctx.start);

  var err = opts.args[0];
  var res = opts.args[1];

  if (err) {
    console.log('error', err.message);
  }

  if (res) {
    console.log('response', res.statusCode);
  }

  next();
};
```

## Example

``` javascript
'use strict';

/**
 * Module dependencies.
 */

var rapi = require('rapi');
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
  var github = new GitHub({ debug: true });

  github.gists('silas', function(err, gists) {
    if (err) throw err;

    console.log('----');

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
```

## License

This work is licensed under the MIT License (see the LICENSE file).
