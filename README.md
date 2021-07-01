# Papi

This is a library for building HTTP API clients.

 * [Documentation](#documentation)
 * [Example](#example)
 * [License](#license)

## Documentation

 * [Client](#client)
 * [Shortcuts](#shortcuts)

<a name="client"></a>
### papi.Client([options])

Initialize a new client.

Your client should extend the Papi `Client` class and call `super(options)`
with the appropriate options.

Options

 * baseUrl (string): base URL, should not include trailing slash
 * headers (Object&lt;string, string&gt;, optional): defaults headers to include in every request
 * type (string, optional, supports: form, json, text): default request body encoding type
 * encoders (Object&lt;string, Function&gt;, optional): an object that maps a mime type to a function. The function should accept an object and return a Buffer.
 * decoders (Object&lt;string, Function&gt;, optional): an object that maps a mime type to a function. The function should accept a Buffer or string (must support both) and return an object.
 * tags (string[], optional): tags included in `_log` calls
 * socketPath (string, optional): unix socket path (baseUrl is still required)
 * timeout (number, optional): default number of milliseconds before request is aborted

Advanced options

 * agent (http.Agent|https.Agent, optionals): if not set uses the global agent
 * tls options: ca, cert, ciphers, clientCertEngine, crl, dhparam, ecdhCurve, honorCipherOrder, key, passphrase, pfx, rejectUnauthorized, secureOptions, secureProtocol, servername, and sessionIdContext (see [Node.js docs](https://nodejs.org/dist/latest/docs/api/tls.html#tls_tls_connect_options_callback) for details)

Usage

``` javascript
const papi = require('papi');

class GitHub extends papi.Client {
  constructor(opts) {
    opts = opts || {};
    opts.baseUrl = 'https://api.github.com';
    opts.header = { accept: 'application/vnd.github.v3+json' };
    opts.timeout = 15 * 1000;

    super(opts);
  }
}
```

<a name="client-request"></a>
### client.\_request(request, [middleware...])

Make an HTTP request.

Your client should use this or the shortcut methods listed below to execute
HTTP requests in your client methods.

Arguments

 * request (Object): request options
 * middlware (Function&lt;request, next&gt;, optional): middleware functions that can mutate `request.err` or `request.res`. Call `next` without arguments to continue execution, `next(err)` to break with an error, or `next(false, value)` to return immediately.

Request

 * path (string): request path, can include variable segments defined by curly braces (ex: `/user/{id}`)
 * method (string): request method
 * headers (Object&lt;string, string&gt;, optional): request headers
 * params (Object&lt;string, string&gt;, optional): sets variables in request path
 * query (Object&lt;string, string|string[]&gt;, optional): query parameters
 * body (Object|Buffer|Readable, optional): request body
 * type (string, optional, supports: form, json, text): request body encoding type
 * ctx (EventEmitter, optional): emit `cancel` to abort request
 * timeout (number, optional): number of milliseconds before request is aborted
 * tags (string[], optional): tags included in `_log` calls

There are also `_get`, `_head`, `_post`, `_put`, `_delete`, `_patch`,
and `_options` shortcuts with the same method signature as `_request`.

Usage

``` javascript
class GitHub extends papi.Client {
  constructor() {
    // see example constructor above
  }

  async gists(username) {
    const opts = {
      path: '/users/{username}/gists',
      params: { username: username },
    };

    const res = await this._get(opts);
    return res.body;
  }
}
```

Result

```
[ { url: 'https://api.github.com/gists/9458207',
...
```

### client.\_log(tags, [data])

Emit log events.

Arguments

 * tags (string[]): tags associated with event
 * data (optional): remaining arguments

Usage

``` javascript
client.on('log', function(tags) {
  console.log({
    tags: tags,
    data: Array.prototype.slice.call(arguments, 1),
  });
});;

client._log(['github', 'gist'], 'silas');
```

Result

```
{ data: [ 'silas' ], tags: [ 'debug', 'github', 'gist' ] }
```

### client.\_ext(event, callback)

Register an extension function.

Arguments

 * event (string): event name
 * callback (Function): function to execute at a specified point during the request

Usage

``` javascript
client._ext('onRequest', (request, next) => {
  console.log('request', request.opts.method + ' ' + request.opts.path);

  request.start = new Date();

  next();
});

client._ext('onResponse', (request, next) => {
  const duration = new Date() - request.start;
  const statusCode = request.res ? request.res.statusCode : 'none';

  console.log('response', request.opts.method, request.opts.path, statusCode, duration + 'ms');

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

<a name="shortcuts"></a>
### papi.request(request, [callback...])

Shortcuts for making one-off requests.

See [client request](#client-request) for full options list, with the exception
that `path` is replaced with `url`.

Request

 * url (string): request url (ex: `http://example.org/`)

There are also `get`, `head`, `post`, `put`, `delete` (`del`), `patch`, and
`options` shortcuts with the same method signature as `request`.

Usage

``` javascript
async function show() {
  const res = await papi.get('https://api.github.com/users/silas/gists');

  res.body.forEach(gist => console.log(gist.url));
}
```


## Example

``` javascript
const papi = require('papi');

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
```

## License

This work is licensed under the MIT License (see the LICENSE file).
