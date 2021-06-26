'use strict';

const Client = require('./client').Client;
const errors = require('./errors');

/**
 * Request.
 */

async function request(opts) {
  if (typeof opts === 'string' || opts instanceof URL) {
    arguments[0] = opts = { method: 'get', url: opts };
  } else {
    opts = opts || {};
  }

  if (!opts.url) {
    throw new errors.ValidationError('url required');
  }

  let baseUrl;
  if (typeof opts.url === 'string') {
    baseUrl = new URL(opts.url);
  } else if (opts.url instanceof URL) {
    baseUrl = opts.url;
  } else {
    throw new errors.ValidationError('url must be a string');
  }

  opts.path = baseUrl.pathname.replace('%7B', '{').replace('%7D', '}');
  baseUrl = new URL('/', baseUrl);

  const client = new Client({ baseUrl: baseUrl });

  delete opts.url;

  return await client._request.apply(client, arguments);
}

/**
 * Method.
 */

function method(name) {
  return async function(opts) {
    if (typeof opts === 'string' || opts instanceof URL) {
      arguments[0] = opts = { url: opts };
    } else {
      opts = opts || {};
    }

    opts.method = name;

    return await request.apply(null, arguments);
  };
}

exports.method = method;
exports.request = request;
