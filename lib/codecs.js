/**
 * Encoders/Decoders
 */

'use strict';

/**
 * Module dependencies.
 */

var querystring = require('querystring');
var errors = require('./errors');

/**
 * Text
 */

var text = {};

text.encode = function(data) {
  return new Buffer(data, 'utf8');
};

text.decode = function(data) {
  return Buffer.isBuffer(data) ? data.toString() : data;
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

form.multipart = function(data) {
  // parts is a list of dictionaries of strings or Buffer objects
  var parts = data.parts;
  var boundary = data.boundary;
  var body = [];
  function add(part) {
    body.push(Buffer.from(part));
  }

  Object.keys(parts).forEach(function(key) {
    var preamble = '--' + boundary + '\r\n';
    preamble += 'Content-Disposition: form-data; name="' + key + '"; ' +
      'filename="' + (parts[key].filename || key) + '"\r\n';
    if (typeof parts[key] === 'string' || Buffer.isBuffer(parts[key])) {
      preamble += '\r\n';
      add(preamble);
      add(parts[key]);

    } else if (typeof parts[key] === 'object')  {
      var part = parts[key];
      Object.keys(part).forEach(function(key2) {
	if (key2 === 'body' || key2 === 'filename') { return; }
	preamble += key2 + ': ' + part[key2] + '\r\n';
      });
      preamble += '\r\n';
      add(preamble);
      add(part.body);
    } else {
      throw errors.Validation('invalid multipart part data type');
    }
    add('\r\n');
  });
  add('--' + boundary + '--');
  add('\r\n');

  return Buffer.concat(body);
};

/**
 * Module exports.
 */

exports.json = json;
exports.form = form;
exports.text = text;
