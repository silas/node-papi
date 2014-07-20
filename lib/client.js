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
    throw new Error('baseUrl must be a string');
  }

  opts.baseUrl = url.parse(opts.baseUrl);

  if (opts.baseUrl.path === '/') {
    opts.baseUrl.path = '';
  } else if (opts.baseUrl.path[opts.baseUrl.path.length - 1] === '/') {
    throw new Error('baseUrl must not end with a forward slash');
  }

  opts.headers = utils.mergeHeaders({}, opts.headers);
  opts.tags = opts.tags || [];

  opts.encoders = utils.merge(constants.ENCODERS, opts.encoders);
  opts.decoders = utils.merge(constants.DECODERS, opts.decoders);

  this._opts = opts;
  this._exts = {};
}

util.inherits(Client, events.EventEmitter);

/**
 * Register an extension
 */

Client.prototype._ext = function(eventName, method) {
  if (!this._exts[eventName]) {
    this._exts[eventName] = [];
  }
  this._exts[eventName].push(method);
};

/**
 * Register a plugin
 */

Client.prototype._plugin = function(plugin, options) {
  if (!plugin) {
    throw new Error('plugin required');
  }

  if (typeof plugin.register !== 'function') {
    throw new Error('plugin must have register function');
  }

  var attributes = plugin.register.attributes;

  if (!attributes) {
    throw new Error('plugin attributes required');
  }

  if (!attributes.name) {
    throw new Error('plugin name attribute required');
  }

  if (!attributes.version) {
    throw new Error('plugin name version required');
  }

  return plugin.register(this, options || {});
};

/**
 * Log request events
 */

Client.prototype._log = function(tags) {
  return this.emit('log', {
    data: Array.prototype.slice.call(arguments, 1),
    tags: this._opts.tags.concat(tags),
  });
};

/**
 * Encode
 */

Client.prototype._encode = function(mime, value) {
  if (!this._opts.encoders[mime]) {
    throw new Error('Unknown encoder: ' + mime);
  }

  try {
    return this._opts.encoders[mime](value);
  } catch (err) {
    err.message = 'Encode (' + mime + ') failed: ' + err.message;
    throw err;
  }
};

/**
 * Decode
 */

Client.prototype._decode = function(mime, value) {
  if (!this._opts.decoders[mime]) {
    throw new Error('Unknown decoder: ' + mime);
  }

  try {
    return this._opts.decoders[mime](value);
  } catch (err) {
    err.message = 'Decode (' + mime + ') failed: ' + err.message;
    throw err;
  }
};

/**
 * Run request pipeline
 */

Client.prototype._request = function() {
  var self = this;

  var args = utils.requestArgs.apply(this, arguments);

  var ctx = {
    path: args.path,
    opts: args.opts,
    callback: args.callback,
  };

  var result;

  if (self._exts.onReturn) {
    self._exts.onReturn.forEach(function(fn) {
      result = fn(ctx, result);
    });
  }

  args.callback = ctx.callback;
  delete ctx.callback;

  var jobs = [];

  if (self._exts.onCreate) {
    jobs = jobs.concat(self._exts.onCreate);
  }

  jobs.push(self.__create);

  if (self._exts.onRequest) {
    jobs = jobs.concat(self._exts.onRequest);
  }

  jobs.push(self.__execute);

  if (self._exts.onResponse) {
    jobs = jobs.concat(self._exts.onResponse);
  }

  var i = 0;
  function next(err) {
    if (err) {
      if (!ctx.next) return args.callback(err);
      ctx.err = err;
    }

    if (ctx.next === false) {
      return;
    }

    delete ctx.next;

    var fn = jobs[i++];
    if (fn) {
      fn.call(self, ctx, next);
    } else {
      args.callback.call(self, ctx.err, ctx.res);
    }
  }

  process.nextTick(next);

  return result;
};

/**
 * Create HTTP request
 */

Client.prototype.__create = function(ctx, next) {
  var self = this;

  var path = ctx.path;
  var opts = ctx.opts;
  var body;

  var headers = utils.mergeHeaders(self._opts.headers, opts.headers);

  if (typeof path !== 'string') {
    return next(new Error('path required'));
  }

  if (!utils.isEmpty(opts.path)) {
    path = path.replace(/\{(\w+)\}/g, function(src, dst) {
      return opts.path.hasOwnProperty(dst) ?
        encodeURIComponent(opts.path[dst]) :
        src;
    });
  }

  if (!utils.isEmpty(opts.query)) {
    try {
      path += '?' + self._encode('application/x-www-form-urlencoded',
                                 opts.query).toString();
    } catch (err) {
      return next(err);
    }
  }

  if (opts.body !== undefined) {
    var mime = constants.MIME_ALIAS[opts.type] ||
      headers['content-type'] ||
      constants.MIME_ALIAS[self._opts.type];

    var isBuffer = Buffer.isBuffer(opts.body);

    if (!isBuffer && !mime) {
      return next(new Error('type required'));
    }

    if (isBuffer) {
      body = opts.body;
    } else {
      if (self._opts.encoders[mime]) {
        try {
          body = this._encode(mime, opts.body);
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

    headers['content-length'] = body.length;
  } else if (!~constants.EXCLUDE_CONTENT_LENGTH.indexOf(opts.method)) {
    headers['content-length'] = 0;
  }

  ctx.req = utils.merge(
    utils.pick(self._opts.baseUrl, 'auth', 'hostname', 'port', 'path'),
    utils.pick(opts, 'method'),
    { headers: headers }
  );

  if (body !== undefined) ctx.req.body = body;

  ctx.req.path += path;

  if (self._opts.baseUrl.protocol === 'https:') {
    ctx.transport = https;
    if (!ctx.req.port) ctx.req.port = 443;
  } else {
    ctx.transport = http;
    if (!ctx.req.port) ctx.req.port = 80;
  }

  if (utils.isEmpty(ctx.req.headers)) delete ctx.req.headers;
  if (!ctx.req.auth) delete ctx.req.auth;

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

  self._log(['debug', 'options', 'request'].concat(tags), ctx.req);

  var request = ctx.transport.request(ctx.req);

  request.on('error', function(err) {
    self._log(['error', 'request'].concat(tags), err);

    if (done) {
      if (timeoutId) clearTimeout(timeoutId);
      return;
    }
    done = true;

    next(err);
  });

  if (timeout && timeout > 0) {
    timeoutId = setTimeout(function() {
      request.abort();
      self._log(['error', 'request', 'timeout'].concat(tags));
    }, timeout);

    request.setTimeout(timeout, function() {
      self._log(['error', 'request', 'timeout'].concat(tags));
    });
  }

  request.on('response', function(res) {
    var chunks = [];
    var bodyLength = 0;

    ctx.res = res;

    res.on('data', function(chunk) {
      chunks.push(chunk);
      bodyLength += chunk.length;
    });

    res.on('end', function() {
      if (done) return;
      done = true;

      if (timeoutId) clearTimeout(timeoutId);

      self._log(['debug', 'response', 'statusCode'].concat(tags),
                res.statusCode);
      self._log(['debug', 'response', 'headers'].concat(tags), res.headers);

      var mime = (res.headers['content-type'] || '').split(';')[0].trim();

      if (chunks.length) {
        res.body = Buffer.concat(chunks, bodyLength);

        self._log(['body', 'debug', 'response'].concat(tags), res.body);

        if (!opts.buffer) {
          if (self._opts.decoders[mime]) {
            try {
              res.body = self._decode(mime, res.body);
            } catch (err) {
              return next(err);
            }
          }
        }
      }

      if (Math.floor(res.statusCode / 100) !== 2) {
        ctx.next = true;

        var err = new Error();

        if (mime === 'text/plain' && typeof res.body === 'string' &&
            res.body.length < 80) {
          err.message = res.body;
        }

        if (!err.message) {
          err.message = http.STATUS_CODES[res.statusCode];
        }

        if (!err.message) {
          err.message = 'Request failed: ' + res.statusCode;
        }

        return next(err);
      }

      next();
    });
  });

  request.end(ctx.req.body);
};

/**
 * Shortcuts
 */

constants.METHODS.forEach(function(method) {
  var reqMethod = method.toUpperCase();

  Client.prototype['_' + method] = function() {
    var args = utils.requestArgs.apply(this, arguments);

    args.opts.method = reqMethod;

    return this._request(args.path, args.opts, args.callback);
  };
});

/**
 * Module Exports.
 */

exports.Client = Client;
