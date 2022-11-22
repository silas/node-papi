'use strict';

const events = require('events');
const http = require('http');
const https = require('https');
const util = require('util');

const constants = require('./constants');
const errors = require('./errors');
const meta = require('../package.json');
const utils = require('./utils');

class Client extends events.EventEmitter {
  constructor(opts) {
    super();

    opts = opts || {};

    if (typeof opts === 'string' || opts instanceof URL) {
      opts = { baseUrl: opts };
    } else {
      opts = utils.merge(opts);
    }

    if (!opts.baseUrl) {
      throw new errors.ValidationError('baseUrl required');
    }

    if (!(opts.baseUrl instanceof URL)) {
      if (typeof opts.baseUrl !== 'string') {
        throw new errors.ValidationError('baseUrl must be a string: ' +
          opts.baseUrl);
      }

      opts.baseUrl = new URL(opts.baseUrl);
    }

    const baseUrl = {};
    baseUrl.protocol = opts.baseUrl.protocol;
    baseUrl.hostname = opts.baseUrl.hostname;
    if (opts.baseUrl.username) {
      baseUrl.auth = decodeURIComponent(opts.baseUrl.username);
    }
    if (opts.baseUrl.password) {
      baseUrl.auth = (baseUrl.auth || '') + ':' +
        decodeURIComponent(opts.baseUrl.password);
    }
    if (opts.baseUrl.port) baseUrl.port = opts.baseUrl.port;
    if (!opts.baseUrl.pathname || opts.baseUrl.pathname === '/') {
      baseUrl.path = '';
    } else if (
        opts.baseUrl.pathname[opts.baseUrl.pathname.length - 1] === '/') {
      throw new errors.ValidationError(
          'baseUrl must not end with a forward slash');
    } else {
      baseUrl.path = opts.baseUrl.pathname;
    }
    opts.baseUrl = baseUrl;

    opts.headers = utils.mergeHeaders(opts.headers);
    if (opts.tags) {
      if (Array.isArray(opts.tags)) {
        opts.tags = opts.tags.slice(0);
      } else {
        throw new errors.ValidationError('tags must be an array');
      }
    } else {
      opts.tags = [];
    }

    if (opts.name && !~opts.tags.indexOf(opts.name)) {
      opts.tags.push(opts.name);
    }

    opts.encoders = utils.merge(constants.ENCODERS, opts.encoders);
    opts.decoders = utils.merge(constants.DECODERS, opts.decoders);

    this._opts = opts;
    this._exts = {};
  }

  /**
   * Add information to error
   */
  _err(err, opts) {
    if (!err) return err;

    if (!(err instanceof Error)) err = new Error(err);

    if (opts && opts.name) {
      err.message = util.format('%s: %s', opts.name, err.message);
    }

    if (this._opts.name) {
      err.message = util.format('%s: %s', this._opts.name, err.message);
    }

    return err;
  }

  /**
   * Register an extension
   */
  _ext(eventName, callback) {
    if (!eventName || typeof eventName !== 'string') {
      throw this._err(new errors.ValidationError(
        'extension eventName required'));
    }

    if (typeof callback !== 'function') {
      throw this._err(new errors.ValidationError(
        'extension callback required'));
    }

    if (!this._exts[eventName]) this._exts[eventName] = [];

    this._exts[eventName].push(callback);
  }

  /**
   * Register a plugin
   */
  _plugin(plugin, options) {
    if (!plugin) {
      throw this._err(new errors.ValidationError('plugin required'));
    }

    if (typeof plugin.register !== 'function') {
      throw this._err(new errors.ValidationError(
        'plugin must have register function'));
    }

    const attributes = plugin.register.attributes;

    if (!attributes) {
      throw this._err(new errors.ValidationError('plugin attributes required'));
    }

    if (!attributes.name) {
      throw this._err(new errors.ValidationError(
        'plugin attributes name required'));
    }

    if (!attributes.version) {
      throw this._err(new errors.ValidationError(
        'plugin attributes version required'));
    }

    return plugin.register(this, options || {});
  }

  /**
   * Log request events
   */
  _log(tags, data) {
    return this.emit('log', tags, data);
  }

  /**
   * Encode
   */
  _encode(mime, value) {
    if (!this._opts.encoders[mime]) {
      throw new errors.CodecError('unknown encoder: ' + mime);
    }

    try {
      return this._opts.encoders[mime](value);
    } catch (err) {
      err.message = 'encode (' + mime + ') failed: ' + err.message;
      throw new errors.CodecError(err);
    }
  }

  /**
   * Decode
   */
  _decode(mime, value) {
    if (!this._opts.decoders[mime]) {
      throw new errors.CodecError('unknown decoder: ' + mime);
    }

    try {
      return this._opts.decoders[mime](value);
    } catch (err) {
      err.message = 'decode (' + mime + ') failed: ' + err.message;
      throw new errors.CodecError(err);
    }
  }

  /**
   * Push ext list
   */
  __push(request, name) {
    if (this._exts[name]) {
      request._stack.push.apply(request._stack, this._exts[name]);
    }

    if (request.opts && request.opts.exts && request.opts.exts[name]) {
      if (Array.isArray(request.opts.exts[name])) {
        request._stack.push.apply(request._stack, request.opts.exts[name]);
      } else {
        request._stack.push(request.opts.exts[name]);
      }
    }
  }

  /**
   * Run client request
   */
  _request(opts) {
    if (!opts) opts = {};

    const request = {
      opts: opts,
      state: {},
    };

    // if ctx is an event emitter we use it to abort requests when done is
    // emitted
    if (opts.ctx instanceof events.EventEmitter) {
      request.ctx = opts.ctx;
    }

    // combine global and request tags
    opts.tags = (opts.tags || []).concat(this._opts.tags);

    // inject request name into tags if not already defined
    if (opts.name && !~opts.tags.indexOf(opts.name)) {
      opts.tags.push(opts.name);
    }

    if (!opts.headers) opts.headers = {};
    if (!opts.params) opts.params = {};
    if (!opts.query) opts.query = {};

    // restart request
    request.retry = () => {
      if (request._retryable === false) {
        throw new errors.ValidationError('request is not retryable');
      }

      this._log(['papi', 'request', 'retry'].concat(request.opts.tags));

      delete request.body;
      delete request.err;
      delete request.req;
      delete request.res;
      delete request.transport;

      this.__pipeline(request);
    };

    request._stack = [];

    this.__push(request, 'onCreate');

    request._stack.push(this.__create);

    this.__push(request, 'onRequest');

    request._stack.push(this.__execute);

    this.__push(request, 'onResponse');

    request._stack.push.apply(request._stack,
      Array.prototype.slice.call(arguments, 1));

    return new Promise((resolve, reject) => {
      request._resolve = resolve;
      request._reject = reject;

      this.__pipeline(request);
    });
  }

  /**
   * Run request pipeline
   */
  __pipeline(request) {
    const self = this;

    let i = 0;
    function next(err, value, maybeValue) {
      if (err) return request._reject(self._err(err, request.opts));

      // middleware can call next(false, value) to stop middleware
      if (err === false) {
        // basic backwards compatibility for old interface
        if (value instanceof Error) {
          return request._reject(value);
        } else if (!value && maybeValue) {
          value = maybeValue;
        }

        return request._resolve(value);
      }

      const fn = request._stack[i++];
      if (fn) {
        fn.call(self, request, next);
      } else if (request.err) {
        request._reject(self._err(request.err, request.opts));
      } else {
        request._resolve(request.res);
      }
    }

    next();
  }

  /**
   * Create HTTP request
   */
  __create(request, next) {
    const opts = request.opts;
    let path = opts.path;

    if (typeof path !== 'string') {
      return next(new errors.ValidationError('path required'));
    }

    const headers = utils.mergeHeaders(this._opts.headers, opts.headers);

    // path
    try {
      path = path.replace(/\{(\w+)\}/g, (src, dst) => {
        if (!opts.params.hasOwnProperty(dst)) {
          throw new errors.ValidationError('missing param: ' + dst);
        }

        let part = opts.params[dst] || '';

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
        path += '?' + this._encode('application/x-www-form-urlencoded',
                                   opts.query).toString();
      } catch (err) {
        return next(err);
      }
    }

    // body
    if (opts.body !== undefined) {
      let mime = constants.MIME_ALIAS[opts.type] ||
        headers['content-type'] ||
        constants.MIME_ALIAS[this._opts.type];

      let isFunction = typeof opts.body === 'function';

      if (isFunction) {
        try {
          request.body = opts.body();
        } catch (err) {
          return next(err);
        }
      } else {
        request.body = opts.body;
      }

      const isBuffer = Buffer.isBuffer(request.body);
      const isStream = utils.isReadableStream(request.body);

      if (!isBuffer && !isStream && !mime) {
        return next(new errors.ValidationError('type required'));
      }

      if (!isBuffer && !isStream) {
        if (this._opts.encoders[mime]) {
          try {
            request.body = this._encode(mime, request.body);
          } catch (err) {
            return next(err);
          }
        } else {
          return next(new errors.CodecError('type is unknown: ' + mime));
        }
      }

      if (!headers['content-type'] && mime) {
        headers['content-type'] = mime + '; charset=' + constants.CHARSET;
      }

      if (isStream) {
        if (!isFunction) request._retryable = false;
      } else {
        headers['content-length'] = request.body.length;
      }
    } else if (!~constants.EXCLUDE_CONTENT_LENGTH.indexOf(
               (opts.method || '').toUpperCase())) {
      headers['content-length'] = 0;
    }

    // response pipe
    if (opts.pipe) {
      const isPipeFunction = typeof opts.pipe === 'function';

      if (isPipeFunction) {
        try {
          request.pipe = opts.pipe();
        } catch (err) {
          return next(err);
        }
      } else {
        request.pipe = opts.pipe;

        request._retryable = false;
      }

      if (!utils.isWritableStream(request.pipe)) {
        return next(new errors.ValidationError(
          'pipe must be a writable stream'));
      }
    }

    // build http.request options
    request.req = utils.merge(
      utils.pick(this._opts, constants.CLIENT_OPTIONS),
      this._opts.socketPath ?
          utils.pick(this._opts.baseUrl, 'auth', 'path') :
          utils.pick(this._opts.baseUrl, 'auth', 'hostname', 'port', 'path'),
      utils.pick(opts, constants.REQUEST_OPTIONS),
      { headers: headers }
    );

    // append request path to baseUrl
    request.req.path += path;

    // pick http transport
    if (this._opts.baseUrl.protocol === 'https:') {
      request.transport = https;
      if (!request.req.port && !this._opts.socketPath) {
        request.req.port = 443;
      }
    } else {
      request.transport = http;
      if (!request.req.port && !this._opts.socketPath) {
        request.req.port = 80;
      }
    }

    next();
  }

  /**
   * Execute HTTP request
   */
  __execute(request, next) {
    if (request.ctx) {
      if (request.ctx.canceled === true) {
        return next(new errors.ValidationError('ctx already canceled'));
      } else if (request.ctx.finished === true) {
        return next(new errors.ValidationError('ctx already finished'));
      }
    }

    let done = false;

    const opts = request.opts;

    let abort;
    let timeoutId;
    let timeout = opts.hasOwnProperty('timeout') ?
      opts.timeout : this._opts.timeout;

    this._log(['papi', 'request'].concat(opts.tags), request.req);

    const req = request.transport.request(request.req);

    const userAgent = req.getHeader('user-agent');

    if (userAgent === undefined) {
      req.setHeader('user-agent', 'papi/' + meta.version);
    } else if (userAgent === null) {
      req.removeHeader('user-agent');
    }

    req.on('error', err => {
      this._log(['papi', 'request', 'error'].concat(opts.tags), err);

      if (done) return;
      done = true;

      if (abort) request.ctx.removeListener('cancel', abort);
      if (timeoutId) clearTimeout(timeoutId);

      request.err = err;
      next();
    });

    if (request.ctx) {
      abort = () => {
        req.abort();
        req.emit('error', new errors.AbortError('request aborted'));
      };

      request.ctx.once('cancel', abort);
    }

    // set request and absolute timeout
    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => {
        req.emit('timeout');
        req.abort();
      }, timeout);

      req.setTimeout(timeout);
    }

    req.on('timeout', err => {
      this._log(['papi', 'request', 'error', 'timeout'].concat(opts.tags));
      if (err) {
        err = new errors.TimeoutError(err);
      } else {
        err = new errors.TimeoutError('request timed out (' + timeout + 'ms)');
      }
      req.emit('error', err);
    });

    req.on('response', (res) => {
      let chunks = [];
      let bodyLength = 0;

      this._log(['papi', 'response'].concat(opts.tags), {
        method: opts.method,
        path: req.path,
        statusCode: res.statusCode,
        headers: res.headers,
        remoteAddress: res.socket && res.socket.remoteAddress,
        remotePort: res.socket && res.socket.remotePort,
      });

      request.res = res;

      if (request.pipe) {
        res.pipe(request.pipe);
      } else {
        res.on('data', (chunk) => {
          chunks.push(chunk);
          bodyLength += chunk.length;
        });
      }

      res.on('end', () => {
        if (done) return;
        done = true;

        if (abort) request.ctx.removeListener('cancel', abort);
        if (timeoutId) clearTimeout(timeoutId);

        // body content mime
        let mime;

        // decode body
        if (bodyLength) {
          res.body = Buffer.concat(chunks, bodyLength);

          // don't decode if user explicitly asks for buffer
          if (!opts.buffer) {
            mime = (res.headers['content-type'] || '').split(';')[0].trim();

            if (this._opts.decoders[mime]) {
              try {
                res.body = this._decode(mime, res.body);
              } catch (err) {
                request.err = err;
                return next();
              }
            }
          }
        }

        // any non-200 is consider an error
        if (Math.floor(res.statusCode / 100) !== 2) {
          let message;

          if (res.body && mime === 'text/plain' && res.body.length < 80) {
            message = res.body;
          }

          if (!message) {
            if (http.STATUS_CODES[res.statusCode]) {
              message = http.STATUS_CODES[res.statusCode].toLowerCase();
            } else {
              message = 'request failed: ' + res.statusCode;
            }
          }

          request.err = new errors.ResponseError(message, res);
        }

        next();
      });
    });

    if (utils.isReadableStream(request.body)) {
      request.body.pipe(req);
    } else {
      req.end(request.body);
    }
  }

  __shortcut(method, callerArgs) {
    let args;
    let opts = callerArgs[0];

    if (typeof opts === 'string') {
      args = Array.prototype.slice.call(callerArgs);
      args[0] = opts = { path: opts };
    } else if (!opts) {
      args = Array.prototype.slice.call(callerArgs);
      args[0] = opts = {};
    } else {
      args = callerArgs;
    }

    opts.method = method;

    return this._request.apply(this, args);
  }

  _options() {
    return this.__shortcut('OPTIONS', arguments);
  }

  _get() {
    return this.__shortcut('GET', arguments);
  }

  _head() {
    return this.__shortcut('HEAD', arguments);
  }

  _post() {
    return this.__shortcut('POST', arguments);
  }

  _put() {
    return this.__shortcut('PUT', arguments);
  }

  _delete() {
    return this.__shortcut('DELETE', arguments);
  }

  _del() {
    return this.__shortcut('DELETE', arguments);
  }

  _patch() {
    return this.__shortcut('PATCH', arguments);
  }
}

exports.Client = Client;
