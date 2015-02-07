'use strict';

/**
 * Module dependencies.
 */

var Client = require('./client').Client;
var errors = require('./errors');

/**
 * Request.
 */

function request(opts) {
  if (typeof opts === 'string') {
    arguments[0] = opts = { method: 'get', url: opts };
  } else {
    opts = opts || {};
  }

  try {
    if (!opts.url) {
      throw errors.Validation('url required');
    }

    if (typeof opts.url !== 'string') {
      throw errors.Validation('url must be a string');
    }

    var client = new Client({ baseUrl: opts.url });

    opts.path = '';
    delete opts.url;

    client._request.apply(client, arguments);
  } catch (err) {
    var callback = arguments[arguments.length - 1];

    if (typeof callback !== 'function') {
      err.message = 'no callback: ' + err.message;
      throw err;
    }

    callback(err);
  }
}

/**
 * Method.
 */

function method(name) {
  return function(opts) {
    if (typeof opts === 'string') {
      arguments[0] = opts = { url: opts };
    } else {
      opts = opts || {};
    }

    opts.method = name;

    request.apply(null, arguments);
  };
}

/**
 * Module exports.
 */

exports.method = method;
exports.request = request;
