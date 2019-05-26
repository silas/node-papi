'use strict';

const url = require('url');

const Client = require('./client').Client;
const errors = require('./errors');

/**
 * Request.
 */

function request(opts) {
  if (typeof opts === 'string') {
    arguments[0] = opts = { method: 'get', url: opts };
  } else {
    opts = opts || {};
  }

  if (!opts.url) {
    return Promise.reject(new errors.ValidationError('url required'));
  }

  if (typeof opts.url !== 'string') {
    return Promise.reject(new errors.ValidationError('url must be a string'));
  }

  const baseUrl = url.parse(opts.url);

  opts.path = baseUrl.pathname.replace('%7B', '{').replace('%7D', '}');
  baseUrl.pathname = '';

  const client = new Client({ baseUrl: baseUrl });

  delete opts.url;

  return client._request.apply(client, arguments);
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

    return request.apply(null, arguments);
  };
}

exports.method = method;
exports.request = request;
