# Papi [![Build Status](https://travis-ci.org/silas/node-papi.png?branch=master)](https://travis-ci.org/silas/node-papi)

This is a module for building HTTP API clients.

 * [Documentation](#documentation)
 * [Example](#example)
 * [License](#license)

## Documentation

### papi.Client([options])

Initialize a new client.

Options

 * baseUrl (String): base URL, should not include trailing slash
 * headers (Object&lt;String, String&gt;, optional): defaults headers to include in every request
 * type (String, optional, supports: form, json, text): default request body encoding type
 * encoders (Object&lt;String, Function&gt;, optional): an object that maps a mime type to a function. The function should accept an object and return a Buffer.
 * decoders (Object&lt;String, Function&gt;, optional): an object that maps a mime type to a function. The function should accept a Buffer or String (must support both) and return an object.
 * tags (String[], optional): tags included in `_log` calls
 * timeout (Number, optional): default number of milliseconds before request is aborted

Usage

``` javascript
var papi = require('papi');

var client = new papi.Client({
  baseUrl: 'https://api.github.com',
  headers: { 'user-agent': 'PapiGitHub/0.1.0' },
  timeout: 5 * 1000,
});
```

### client.\_request(request, [callback...], callback)

Make an HTTP request.

Arguments

 * request (Object): request options
 * callback... (Function&lt;ctx, next&gt;, optional): middleware functions that can mutate `ctx.err` or `ctx.res`. Call `next` without arguments to continue execution, `next(err)` to break with an error, or `next(false, arguments...)` to trigger the final callback with the given arguments.
 * callback (Function&lt;err, res&gt;): request callback function.

Request

 * path (String): request path, can include variable segments defined by curly braces (ex: `/user/{id}`)
 * method (String): request method
 * headers (Object&lt;String, String&gt;, optional): request headers
 * params (Object&lt;String, String&gt;, optional): sets variables in request path
 * query (Object&lt;String, String|String[]&gt;, optional): query parameters
 * body (Object|Buffer|Readable, optional): request body
 * type (String, optional, supports: form, json, text): request body encoding type
 * timeout (Number, optional): number of milliseconds before request is aborted
 * tags (String[], optional): tags included in `_log` calls

There are also `_get`, `_head`, `_post`, `_put`, `_delete`, `_patch`, and
`_options` shortcuts with the same method signature as `_request`.

Usage

``` javascript
var opts = {
  path: '/users/{username}/gists',
  params: { username: 'silas' },
};

client._get(opts, function(err, res) {
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
 * data (optional): remaining arguments

Usage

``` javascript
client.on('log', function(tags) {
  console.log({
    tags: tags,
    data: Array.prototype.slice.call(arguments, 1),
  });
});;

client._log(['debug', 'github', 'gist'], 'silas');
```

Result

```
{ data: [ 'silas' ], tags: [ 'debug', 'github', 'gist' ] }
```

### client.\_ext(event, callback)

Register an extension function.

Arguments

 * event (String): event name
 * callback (Function): function to execute at a specified point during the request

Usage

``` javascript
client._ext('onRequest', function(ctx, next) {
  console.log('request', ctx.opts.method + ' ' + ctx.opts.path);

  ctx.start = new Date();

  next();
});

client._ext('onResponse', function(ctx, next) {
  var duration = new Date() - ctx.start;
  var statusCode = ctx.res ? ctx.res.statusCode : 'none';

  console.log('response', ctx.opts.method, ctx.opts.path, statusCode, duration + 'ms');

  next();
});
```

Result

```
request GET /users/{username}/gists
response GET /users/{username}/gists 200 1141ms
```

### client.\_plugin(plugin, options)

Register a plugin.

Arguments

 * plugin (Object): plugin module
 * options (Object, optional): plugin options

Usage

``` javascript
client._plugin(require('papi-retry'));
```

## Example

``` javascript
/**
 * Module dependencies.
 */

var papi = require('papi');
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

  papi.Client.call(this, opts);

  if (opts.debug) {
    this.on('log', console.log);
  }
}

util.inherits(GitHub, papi.Client);

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
```

## License

This work is licensed under the MIT License (see the LICENSE file).
