/**
 * Encoders/Decoders
 */

'use strict';

/**
 * Module dependencies.
 */

var querystring = require('querystring');

var constants = require('./constants');

/**
 * Text
 */

var text = {};

text.encode = function(data) {
  return new Buffer(data, constants.ENCODING);
};

text.decode = function(data) {
  return Buffer.isBuffer(data) ? data.toString(constants.CHARSET) : data;
};

/**
 * JSON
 */

var json = {};

json.encode = function(data) {
  return text.encode(JSON.stringify(data));
};

json.decode = function(data) {
  return JSON.parse(text.decode(data));
};

/**
 * Form
 */

var form = {};

form.encode = function(data) {
  return text.encode(querystring.stringify(data));
};

form.decode = function(data) {
  return querystring.parse(text.decode(data));
};

/**
 * Module exports.
 */

exports.json = json;
exports.form = form;
exports.text = text;
