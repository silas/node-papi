/**
 * Encoders/Decoders
 */

'use strict';

/**
 * Module dependencies.
 */

var querystring = require('querystring');

/**
 * JSON
 */

var json = {};

json.encode = function(data) {
  data = JSON.stringify(data);
  return new Buffer(data, 'utf8');
};

json.decode = function(data) {
  if (Buffer.isBuffer(data)) data = data.toString();
  return JSON.parse(data);
};

/**
 * Form
 */

var form = {};

form.encode = function(data) {
  data = querystring.stringify(data);
  return new Buffer(data, 'utf8');
};

form.decode = function(data) {
  if (Buffer.isBuffer(data)) data = data.toString();
  return querystring.parse(data);
};

/**
 * Text
 */

var text = {};

text.encode = function(data) {
  return new Buffer(data, 'utf8');
};

text.decode = function(data) {
  if (Buffer.isBuffer(data)) data = data.toString();
  return data;
};

/**
 * Module exports.
 */

exports.json = json;
exports.form = form;
exports.text = text;
