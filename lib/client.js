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
 * Add information to error
 */

Client.prototype.__err = function(err, opts) {
  if (!err) return err;

  if (typeof err === 'string') {
    err = new Error(err);
  }

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
    throw this.__err('plugin required');
  }

  if (typeof plugin.register !== 'function') {
    throw this.__err('plugin must have register function');
  }

  var attributes = plugin.register.attributes;

  if (!attributes) {
    throw this.__err('plugin attributes required');
  }

  if (!attributes.name) {
    throw this.__err('plugin attributes name required');
  }

  if (!attributes.version) {
    throw this.__err('plugin attributes version required');
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

Client.prototype.__pushExts = function(jobs, name, opts) {
  if (this._exts[name]) {
    jobs.push.apply(jobs, this._exts[name]);
  }

  if (opts && opts.exts && opts.exts[name]) {
    jobs.push.apply(jobs, opts.exts[name]);
  }

  return jobs;
};

/**
 * Run request pipeline
 */

Client.prototype._request = function(opts, callback) {
  var self = this;

  var ctx = {
    opts: opts,
    callback: callback,
  };

  var result;

  if (self._exts.onReturn) {
    self._exts.onReturn.forEach(function(fn) {
      result = fn(ctx, result);
    });
  }

  callback = ctx.callback;

  delete ctx.callback;

  var finish = callback;

  if (opts.format) {
    var format = Array.isArray(opts.format) ? format : [format];

    finish = function() {
      var args = Array.prototype.slice.call(arguments);

      format.forEach(function(fn) { args = fn(args); });

      callback.apply(null, args);
    };
  }

  if (typeof opts.options === 'function') {
    try {
      opts.options.call(opts);
    } catch (err) {
      finish(this.__err(err, opts));
      return result;
    }
  }

  // restart request
  ctx.retry = function() {
    self._log(['debug', 'request', 'retry'].concat(opts.tags || []));

    self._request(opts, callback);
  };

  var jobs = [];

  self.__pushExts(jobs, 'onCreate', opts);

  jobs.push(self.__create);

  self.__pushExts(jobs, 'onRequest', opts);

  jobs.push(self.__execute);

  self.__pushExts(jobs, 'onResponse', opts);

  var i = 0;
  function next(err) {
    if (err) {
      if (!ctx.next) return finish(self.__err(err));
      ctx.err = err;
    }

    delete ctx.next;

    var fn = jobs[i++];
    if (fn) {
      fn.call(self, ctx, next);
    } else {
      finish.call(self, self.__err(ctx.err), ctx.res);
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

  var opts = ctx.opts;
  var path = opts.path;
  var body;

  var headers = utils.mergeHeaders(self._opts.headers, opts.headers);

  if (typeof path !== 'string') {
    return next(new Error('path required'));
  }

  if (!utils.isEmpty(opts.params)) {
    path = path.replace(/\{(\w+)\}/g, function(src, dst) {
      return opts.params.hasOwnProperty(dst) ?
        encodeURIComponent(opts.params[dst]) :
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

  if (body !== undefined) ctx.body = body;

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

  self._log(['debug', 'request'].concat(tags), ctx.req);

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

    self._log(['debug', 'response'].concat(tags), {
      statusCode: res.statusCode,
      headers: res.headers,
      remoteAddress: res.connection.remoteAddress,
      remotePort: res.connection.remotePort,
    });

    ctx.res = res;

    res.on('data', function(chunk) {
      chunks.push(chunk);
      bodyLength += chunk.length;
    });

    res.on('end', function() {
      if (done) return;
      done = true;

      if (timeoutId) clearTimeout(timeoutId);

      var mime = (res.headers['content-type'] || '').split(';')[0].trim();

      if (chunks.length) {
        res.body = Buffer.concat(chunks, bodyLength);

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
          if (http.STATUS_CODES[res.statusCode]) {
            err.message = http.STATUS_CODES[res.statusCode].toLowerCase();
          } else {
            err.message = 'request failed: ' + res.statusCode;
          }
        }

        return next(err);
      }

      next();
    });
  });

  request.end(ctx.body);
};

/**
 * Shortcuts
 */

constants.METHODS.forEach(function(method) {
  var reqMethod = method.toUpperCase();

  Client.prototype['_' + method] = function(opts, callback) {
    if (typeof opts === 'string') {
      opts = { path: opts };
    }

    opts.method = reqMethod;

    return this._request(opts, callback);
  };
});

/**
 * Module Exports.
 */

exports.Client = Client;
