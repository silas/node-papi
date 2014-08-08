/**
 * HTTP client.
 */

'use strict';

/**
 * Module dependencies.
 */

var events = require('events');
var http = require('http');
var https = require('https');
var stream = require('stream');
var url = require('url');
var util = require('util');

var constants = require('./constants');
var utils = require('./utils');

/**
 * Client
 */

function Client(opts) {
  if (!(this instanceof Client)) {
    return new Client(opts);
  }

  events.EventEmitter.call(this);

  opts = opts || {};

  if (typeof opts === 'string') {
    opts = { baseUrl: opts };
  }

  if (!opts.baseUrl) {
    throw new Error('baseUrl required');
  }

  if (typeof opts.baseUrl !== 'string') {
    throw new Error('baseUrl must be a string: ' + opts.baseUrl);
  }

  opts.baseUrl = url.parse(opts.baseUrl);

  if (opts.baseUrl.path === '/') {
    opts.baseUrl.path = '';
    opts.baseUrl.pathname = '';
  } else if (opts.baseUrl.path[opts.baseUrl.path.length - 1] === '/') {
    throw new Error('baseUrl must not end with a forward slash');
  }

  opts.headers = utils.mergeHeaders(opts.headers);
  opts.tags = opts.tags || [];

  opts.encoders = utils.merge(constants.ENCODERS, opts.encoders);
  opts.decoders = utils.merge(constants.DECODERS, opts.decoders);

  this._opts = opts;
  this._exts = {};
}

util.inherits(Client, events.EventEmitter);

/**
 * Add information to error
 */

Client.prototype._err = function(err, opts) {
  if (!err) return err;

  if (!(err instanceof Error)) err = new Error(err);

  if (opts && opts.name) {
    err.message = util.format('%s: %s', opts.name, err.message);
  }

  if (this._opts.name) {
    err.message = util.format('%s: %s', this._opts.name, err.message);
  }

  return err;
};

/**
 * Register an extension
 */

Client.prototype._ext = function(eventName, callback) {
  if (!eventName || typeof eventName !== 'string') {
    throw this._err('extension eventName required');
  }

  if (typeof callback !== 'function') {
    throw this._err('extension callback required');
  }

  if (!this._exts[eventName]) this._exts[eventName] = [];

  this._exts[eventName].push(callback);
};

/**
 * Register a plugin
 */

Client.prototype._plugin = function(plugin, options) {
  if (!plugin) {
    throw this._err('plugin required');
  }

  if (typeof plugin.register !== 'function') {
    throw this._err('plugin must have register function');
  }

  var attributes = plugin.register.attributes;

  if (!attributes) {
    throw this._err('plugin attributes required');
  }

  if (!attributes.name) {
    throw this._err('plugin attributes name required');
  }

  if (!attributes.version) {
    throw this._err('plugin attributes version required');
  }

  return plugin.register(this, options || {});
};

/**
 * Log request events
 */

Client.prototype._log = function() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('log');

  return this.emit.apply(this, args);
};

/**
 * Encode
 */

Client.prototype._encode = function(mime, value) {
  if (!this._opts.encoders[mime]) {
    throw new Error('unknown encoder: ' + mime);
  }

  try {
    return this._opts.encoders[mime](value);
  } catch (err) {
    err.message = 'encode (' + mime + ') failed: ' + err.message;
    throw err;
  }
};

/**
 * Decode
 */

Client.prototype._decode = function(mime, value) {
  if (!this._opts.decoders[mime]) {
    throw new Error('unknown decoder: ' + mime);
  }

  try {
    return this._opts.decoders[mime](value);
  } catch (err) {
    err.message = 'decode (' + mime + ') failed: ' + err.message;
    throw err;
  }
};

/**
 * Push ext list
 */

Client.prototype.__push = function(ctx, name) {
  if (this._exts[name]) {
    ctx._stack.push.apply(ctx._stack, this._exts[name]);
  }

  if (ctx.opts && ctx.opts.exts && ctx.opts.exts[name]) {
    if (Array.isArray(ctx.opts.exts[name])) {
      ctx._stack.push.apply(ctx._stack, ctx.opts.exts[name]);
    } else {
      ctx._stack.push(ctx.opts.exts[name]);
    }
  }
};

/**
 * Run request pipeline
 */

Client.prototype._request = function(opts) {
  var self = this;

  var ctx;

  if (this.__papi) {
    ctx = this.__papi;
    opts = ctx.opts;
    self = ctx._client;
  } else {
    ctx = {
      _args: Array.prototype.slice.call(arguments),
      _client: this,
      opts: opts,
      state: {},
    };

    if (!opts) opts = ctx.opts = {};

    if (ctx._args.length > 1) {
      ctx._callback = ctx._args[ctx._args.length - 1];
    } else {
      return self.emit('error', self._err('callback required', opts));
    }

    if (!opts.headers) opts.headers = {};
    if (!opts.params) opts.params = {};
    if (!opts.query) opts.query = {};

    // restart request
    ctx.retry = function() {
      if (ctx._retryable === false) {
        throw new Error('request is not retryable');
      }

      self._log(['debug', 'request', 'retry'].concat(ctx.opts.tags || []));

      delete ctx.body;
      delete ctx.err;
      delete ctx.req;
      delete ctx.res;
      delete ctx.transport;

      self._request.call({ __papi: ctx });
    };

    ctx._stack = [];

    ctx._stack.push(self.__create);

    self.__push(ctx, 'onRequest');

    ctx._stack.push(self.__execute);

    self.__push(ctx, 'onResponse');

    ctx._stack.push.apply(ctx._stack, ctx._args.slice(1, ctx._args.length - 1));
  }

  var i = 0;
  function next(err) {
    if (err) return ctx._callback(self._err(err, opts));

    if (err === false) {
      return ctx._callback.apply(null,
        Array.prototype.slice.call(arguments, 1));
    }

    var fn = ctx._stack[i++];
    if (fn) {
      fn.call(self, ctx, next);
    } else {
      ctx._callback.call(self, self._err(ctx.err, opts), ctx.res);
    }
  }

  next();
};

/**
 * Create HTTP request
 */

Client.prototype.__create = function(ctx, next) {
  var self = this;

  var opts = ctx.opts;
  var path = opts.path;

  if (typeof path !== 'string') {
    return next(new Error('path required'));
  }

  var headers = utils.mergeHeaders(self._opts.headers, opts.headers);

  // path
  try {
    path = path.replace(/\{(\w+)\}/g, function(src, dst) {
      if (!opts.params.hasOwnProperty(dst)) {
        throw new Error('missing param: ' + dst);
      }

      var part = opts.params[dst] || '';

      // optionally disable param encoding
      return part.encode === false && part.toString ?
        part.toString() : encodeURIComponent(part);
    });
  } catch (err) {
    return next(err);
  }

  // query
  if (!utils.isEmpty(opts.query)) {
    try {
      path += '?' + self._encode('application/x-www-form-urlencoded',
                                 opts.query).toString();
    } catch (err) {
      return next(err);
    }
  }

  // body
  if (opts.body !== undefined) {
    var mime = constants.MIME_ALIAS[opts.type] ||
      headers['content-type'] ||
      constants.MIME_ALIAS[self._opts.type];

    var isFunction = typeof opts.body === 'function';

    if (isFunction) {
      try {
        ctx.body = opts.body();
      } catch (err) {
        return next(err);
      }
    } else {
      ctx.body = opts.body;
    }

    var isBuffer = Buffer.isBuffer(ctx.body);
    var isStream = ctx.body instanceof stream.Readable;

    if (!isBuffer && !isStream && !mime) {
      return next(new Error('type required'));
    }

    if (!isBuffer && !isStream) {
      if (self._opts.encoders[mime]) {
        try {
          ctx.body = this._encode(mime, ctx.body);
        } catch (err) {
          return next(err);
        }
      } else {
        return next(new Error('type is unknown: ' + mime));
      }
    }

    if (!headers['content-type'] && mime) {
      headers['content-type'] = mime + '; charset=' + constants.CHARSET;
    }

    if (isStream) {
      if (!isFunction) ctx._retryable = false;
    } else {
      headers['content-length'] = ctx.body.length;
    }
  } else if (!~constants.EXCLUDE_CONTENT_LENGTH.indexOf(opts.method)) {
    headers['content-length'] = 0;
  }

  // response pipe
  if (opts.pipe) {
    var isPipeFunction = typeof opts.pipe === 'function';

    if (isPipeFunction) {
      try {
        ctx.pipe = opts.pipe();
      } catch (err) {
        return next(err);
      }
    } else {
      ctx.pipe = opts.pipe;

      ctx._retryable = false;
    }

    if (!(ctx.pipe instanceof stream.Writable)) {
      return next(new Error('pipe must be a writable stream'));
    }
  }

  // build http.request options
  ctx.req = utils.merge(
    utils.pick(self._opts.baseUrl, 'auth', 'hostname', 'port', 'path'),
    utils.pick(opts, 'method'),
    { headers: headers }
  );

  // append request path to baseUrl
  ctx.req.path += path;

  // pick http transport
  if (self._opts.baseUrl.protocol === 'https:') {
    ctx.transport = https;
    if (!ctx.req.port) ctx.req.port = 443;
  } else {
    ctx.transport = http;
    if (!ctx.req.port) ctx.req.port = 80;
  }

  if (ctx.req.auth === null) delete ctx.req.auth;

  next();
};

/**
 * Execute HTTP request
 */

Client.prototype.__execute = function(ctx, next) {
  var self = this;

  var done = false;

  var opts = ctx.opts;
  var tags = opts.tags || [];

  var timeoutId;
  var timeout = opts.hasOwnProperty('timeout') ?
    opts.timeout : self._opts.timeout;

  self._log(['debug', 'request'].concat(tags), ctx.req);

  var request = ctx.transport.request(ctx.req);

  request.on('error', function(err) {
    self._log(['error', 'request'].concat(tags), err);

    if (done) {
      if (timeoutId) clearTimeout(timeoutId);
      return;
    }
    done = true;

    ctx.err = err;
    next();
  });

  // set request and absolute timeout
  if (timeout && timeout > 0) {
    timeoutId = setTimeout(function() {
      request.emit('timeout');
      request.abort();
    }, timeout);

    request.setTimeout(timeout);
  }

  request.on('timeout', function(err) {
    self._log(['error', 'request', 'timeout'].concat(tags));
    if (!err) err = new Error('request timed out (' + timeout + 'ms)');
    request.emit('error', err);
  });

  request.on('response', function(res) {
    var chunks = [];
    var bodyLength = 0;

    self._log(['debug', 'response'].concat(tags), {
      statusCode: res.statusCode,
      headers: res.headers,
      remoteAddress: res.connection.remoteAddress,
      remotePort: res.connection.remotePort,
    });

    ctx.res = res;

    if (ctx.pipe) {
      res.pipe(ctx.pipe);
    } else {
      res.on('data', function(chunk) {
        chunks.push(chunk);
        bodyLength += chunk.length;
      });
    }

    res.on('end', function() {
      if (done) return;
      done = true;

      if (timeoutId) clearTimeout(timeoutId);

      // body content mime
      var mime;

      // decode body
      if (bodyLength) {
        res.body = Buffer.concat(chunks, bodyLength);

        // don't decode if user explicitly asks for buffer
        if (!opts.buffer) {
          mime = (res.headers['content-type'] || '').split(';')[0].trim();

          if (self._opts.decoders[mime]) {
            try {
              res.body = self._decode(mime, res.body);
            } catch (err) {
              ctx.err = err;
              return next();
            }
          }
        }
      }

      // any non-200 is consider an error
      if (Math.floor(res.statusCode / 100) !== 2) {
        var err = new Error();

        if (res.body && mime === 'text/plain' && res.body.length < 80) {
          err.message = res.body;
        }

        if (!err.message) {
          if (http.STATUS_CODES[res.statusCode]) {
            err.message = http.STATUS_CODES[res.statusCode].toLowerCase();
          } else {
            err.message = 'request failed: ' + res.statusCode;
          }
        }

        ctx.err = err;
      }

      next();
    });
  });

  if (ctx.body instanceof stream.Readable) {
    ctx.body.pipe(request);
  } else {
    request.end(ctx.body);
  }
};

/**
 * Shortcuts
 */

constants.METHODS.forEach(function(method) {
  var reqMethod = method.toUpperCase();

  Client.prototype['_' + method] = function(opts) {
    var args;

    if (typeof opts === 'string') {
      opts = { path: opts, method: reqMethod };

      args = Array.prototype.slice.call(arguments);
      args[0] = opts;

      return this._request.apply(this, args);
    } else if (!opts) {
      args = Array.prototype.slice.call(arguments);
      args[0] = {};

      return this._request.apply(this, args);
    }

    opts.method = reqMethod;

    return this._request.apply(this, arguments);
  };
});

/**
 * Module Exports.
 */

exports.Client = Client;
