'use strict';

/**
 * Module dependencies.
 */

var Client = require('./client').Client;

/**
 * Request.
 */

function request(opts, callback) {
  if (typeof opts === 'string') {
    opts = { method: 'get', url: opts };
  } else {
    opts = opts || {};
  }

  try {
    if (!opts.url) {
      throw new Error('url required');
    }

    if (typeof opts.url !== 'string') {
      throw new Error('url must be a string');
    }

    var client = new Client({ baseUrl: opts.url });

    opts.path = '';
    delete opts.url;

    client._request(opts, callback);
  } catch (err) {
    callback(err);
  }
}

/**
 * Method.
 */

function method(name) {
  return function(opts, callback) {
    if (typeof opts === 'string') {
      opts = { url: opts };
    } else {
      opts = opts || {};
    }

    opts.method = name;

    request(opts, callback);
  };
}

/**
 * Module exports.
 */

exports.method = method;
exports.request = request;
