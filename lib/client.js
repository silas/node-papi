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
}

util.inherits(Client, events.EventEmitter);

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
 * Before request
 */

Client.prototype._before = function(ctx, next) {
  next();
};

/**
 * After request
 */

Client.prototype._after = function(ctx, next) {
  next();
};

/**
 * Wrap request in before/after
 */

Client.prototype._request = function(path, opts, callback) {
  var self = this;

  var ctx = {
    path: path,
    opts: opts,
  };

  self._before(ctx, function(err) {
    if (err) return callback(err);

    self.__request(ctx.path, ctx.opts, function() {
      ctx.args = Array.prototype.slice.call(arguments);

      self._after(ctx, function(err) {
        if (err) return callback(err);

        callback.apply(self, ctx.args);
      });
    });
  });
};

/**
 * Execute HTTP request
 */

Client.prototype.__request = function(path, opts, callback) {
  var self = this;

  var timeout;
  var tags = opts.tags || [];

  opts.headers = utils.mergeHeaders(self._opts.headers, opts.headers);

  if (typeof path !== 'string') {
    return callback(new Error('path required'));
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
      return callback(err);
    }
  }

  if (opts.body) {
    var mime = constants.MIME_ALIAS[opts.type] ||
      opts.headers['content-type'] ||
      constants.MIME_ALIAS[self._opts.type];

    var isBuffer = Buffer.isBuffer(opts.body);

    if (!isBuffer && !mime) {
      return callback(new Error('type required'));
    }

    if (!isBuffer) {
      if (self._opts.encoders[mime]) {
        try {
          opts.body = this._encode(mime, opts.body);
        } catch (err) {
          return callback(err);
        }
      } else {
        return callback(new Error('type is unknown: ' + mime));
      }
    }

    if (!opts.headers['content-type'] && mime) {
      opts.headers['content-type'] = mime + '; charset=' + constants.CHARSET;
    }

    opts.headers['content-length'] = opts.body.length;
  }

  var done = false;

  var req = utils.merge(
    utils.pick(self._opts.baseUrl, 'auth', 'hostname', 'port', 'path'),
    utils.pick(opts, 'body', 'method', 'headers')
  );

  req.path += path;
  req.headers = utils.merge(self._opts.headers, opts.headers);

  var transport;

  if (self._opts.baseUrl.protocol === 'https:') {
    transport = https;
    if (!req.port) req.port = 443;
  } else {
    transport = http;
    if (!req.port) req.port = 80;
  }

  if (utils.isEmpty(req.headers)) delete req.headers;
  if (!req.auth) delete req.auth;

  self._log(['debug', 'options', 'request'].concat(tags), req);

  var request = transport.request(req);

  request.on('error', function(err) {
    self._log(['error', 'request'].concat(tags), err);

    if (done) {
      if (timeout) clearTimeout(timeout);
      return;
    }
    done = true;

    callback(err);
  });

  if (!opts.hasOwnProperty('timeout') && self._opts.timeout) {
    opts.timeout = self._opts.timeout;
  }

  if (opts.timeout && opts.timeout > 0) {
    timeout = setTimeout(function() {
      request.abort();
      self._log(['error', 'request', 'timeout'].concat(tags));
    }, opts.timeout);

    request.setTimeout(opts.timeout, function() {
      self._log(['error', 'request', 'timeout'].concat(tags));
    });
  }

  request.on('response', function(res) {
    var chunks = [];
    var bodyLength = 0;

    res.on('data', function(chunk) {
      chunks.push(chunk);
      bodyLength += chunk.length;
    });

    res.on('end', function() {
      if (done) return;
      done = true;

      if (timeout) clearTimeout(timeout);

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
              return callback(err);
            }
          }
        }
      }

      if (Math.floor(res.statusCode / 100) !== 2) {
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

        return callback(err, res);
      }

      callback(null, res);
    });
  });

  request.end(opts.body);
};

/**
 * Shortcuts
 */

constants.METHODS.forEach(function(method) {
  var reqMethod = method.toUpperCase();

  Client.prototype['_' + method] = function(path, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    } else {
      opts = opts || {};
    }

    opts.method = reqMethod;

    return this._request(path, opts, callback);
  };
});

/**
 * Module Exports.
 */

exports.Client = Client;
