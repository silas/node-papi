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
var querystring = require('querystring');
var url = require('url');
var util = require('util');

var utils = require('./utils');

/**
 * Constants.
 */

var ENCODERS = {
  'application/json': JSON.stringify,
  'application/x-www-form-urlencoded': querystring.stringify,
  'text/plain': function(data) { return '' + data; },
};

var DECODERS = {
  'application/json': JSON.parse,
  'application/x-www-form-urlencoded': querystring.parse,
  'text/plain': function(data) { return data; },
};

var MIME_ALIAS = {
  form: 'application/x-www-form-urlencoded',
  json: 'application/json',
  qs: 'application/x-www-form-urlencoded',
  querystring: 'application/x-www-form-urlencoded',
  text: 'text/plain',
};

/**
 * Rapi
 */

function Rapi(opts) {
  if (!(this instanceof Rapi)) {
    return new Rapi(opts);
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

  opts.encoders = utils.merge(ENCODERS, opts.encoders);
  opts.decoders = utils.merge(DECODERS, opts.decoders);

  this.opts = opts;
}

util.inherits(Rapi, events.EventEmitter);

/**
 * Encode
 */

Rapi.prototype._encode = function(mime, value) {
  if (!this.opts.encoders[mime]) {
    throw new Error('Unknown encoder: ' + mime);
  }

  try {
    return this.opts.encoders[mime](value);
  } catch (err) {
    err.message = 'Encode (' + mime + ') failed: ' + err.message;
    throw err;
  }
};

/**
 * Decode
 */

Rapi.prototype._decode = function(mime, value) {
  if (!this.opts.decoders[mime]) {
    throw new Error('Unknown decoder: ' + mime);
  }

  if (Buffer.isBuffer(value)) {
    value = value.toString();
  }

  try {
    return this.opts.decoders[mime](value);
  } catch (err) {
    err.message = 'Decode (' + mime + ') failed: ' + err.message;
    throw err;
  }
};

/**
 * HTTP requests
 */

Rapi.prototype.request = function(opts, callback) {
  var self = this;

  var timeout;

  opts = utils.merge({ headers: {} }, opts);

  if (!opts.path) {
    return callback(new Error('path required'));
  }

  if (!utils.isEmpty(opts.query)) {
    try {
      opts.path += '?' + self._encode('application/x-www-form-urlencoded',
                                      opts.query);
    } catch (err) {
      return callback(err);
    }
  }

  if (opts.body) {
    var mime = MIME_ALIAS[opts.type] || opts.headers['content-type'];

    var isBuffer = Buffer.isBuffer(opts.body);

    if (!isBuffer && !mime) {
      return callback(new Error('type required'));
    }

    if (!isBuffer) {
      if (self.opts.encoders[mime]) {
        try {
          opts.body = this._encode(mime, opts.body);
        } catch (err) {
          return callback(err);
        }
      } else {
        return callback(new Error('type is unknown: ' + mime));
      }

      try {
        opts.body = new Buffer(opts.body, 'utf8');
      } catch (err) {
        return callback(err);
      }
    }

    if (!opts.headers['content-type'] && mime) {
      opts.headers['content-type'] = mime + '; charset=utf-8';
    }

    opts.headers['content-length'] = opts.body.length;
  }

  var done = false;

  var req = utils.merge(
    utils.pick(self.opts.baseUrl, 'auth', 'hostname', 'port', 'path'),
    utils.pick(opts, 'body', 'method', 'headers')
  );

  req.path += opts.path;
  req.headers = utils.merge(self.opts.headers, opts.headers);

  var transport;

  if (self.opts.baseUrl.protocol === 'https:') {
    transport = https;
    if (!req.port) req.port = 443;
  } else {
    transport = http;
    if (!req.port) req.port = 80;
  }

  if (utils.isEmpty(req.headers)) delete req.headers;
  if (!req.auth) delete req.auth;

  self.emit('debug', 'request', req);

  var request = transport.request(req);

  request.on('error', function(err) {
    self.emit('debug', 'request.error', err);

    if (done) {
      if (timeout) clearTimeout(timeout);
      return;
    }
    done = true;

    callback(err);
  });

  if (opts.timeout && opts.timeout > 0) {
    timeout = setTimeout(function() {
      request.abort();
      request.emit('error', new Error('Timeout'));
    }, opts.timeout);

    request.setTimeout(opts.timeout, function() {
      request.emit('error', new Error('Timeout'));
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

      self.emit('debug', 'response.statusCode', res.statusCode);
      self.emit('debug', 'response.headers', res.headers);

      if (chunks.length) {
        res.body = Buffer.concat(chunks, bodyLength);

        self.emit('debug', 'response.body', res.body);

        if (!opts.buffer) {
          var mime = (res.headers['content-type'] || '').split(';')[0].trim();

          if (self.opts.decoders[mime]) {
            try {
              res.body = self._decode(mime, res.body);
            } catch (err) {
              return callback(err);
            }
          }
        }
      }

      if (res.statusCode >= 400) {
        return callback(new Error(
          typeof res.body === 'string' ?
            res.body :
            (http.STATUS_CODES[res.statusCode] ||
             'Error status code: ' + res.statusCode)
        ), res);
      }

      callback(null, res);
    });
  });

  request.end(opts.body);
};

/**
 * Module Exports.
 */

exports.Rapi = Rapi;
