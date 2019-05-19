'use strict';

const querystring = require('querystring');

/**
 * Text
 */

const text = {
  encode: data => Buffer.from(data, 'utf8'),
  decode: data => Buffer.isBuffer(data) ? data.toString() : data,
};

/**
 * JSON
 */

const json = {
  encode: data => text.encode(JSON.stringify(data)),
  decode: data => JSON.parse(text.decode(data)),
};

/**
 * Form
 */

const form = {
  encode: data => text.encode(querystring.stringify(data)),
  decode: data => querystring.parse(text.decode(data)),
};

exports.json = json;
exports.form = form;
exports.text = text;
