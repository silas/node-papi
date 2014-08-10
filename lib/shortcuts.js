'use strict';

/**
 * Module dependencies.
 */

var url = require('url');

var Client = require('./client').Client;
var utils = require('./utils');

/**
 * Request.
 */

function request(opts, callback) {
  if (typeof opts === 'string') {
    opts = { url: opts };
  } else {
    opts = opts || {};
  }

  try {
    if (!opts.url) {
      throw new Error('url required');
    }

    if (typeof opts.url !== 'string') {
      throw new Error('url required');
    }

    var u = url.parse(opts.url);
    var baseUrl = url.format(utils.pick(u, 'protocol', 'host', 'path'));
    opts.path = u.path;

    var client = new Client({ baseUrl: baseUrl });

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
