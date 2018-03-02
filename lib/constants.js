'use strict';

/**
 * Module dependencies.
 */

var codecs = require('./codecs');

/**
 * Constants
 */

exports.CHARSET = 'utf-8';

exports.ENCODERS = {
  'application/json': codecs.json.encode,
  'application/x-www-form-urlencoded': codecs.form.encode,
  'multipart/form-data': codecs.form.multipart,
  'text/plain': codecs.text.encode,
};

exports.DECODERS = {
  'application/json': codecs.json.decode,
  'application/x-www-form-urlencoded': codecs.form.decode,
  'text/html': codecs.text.decode,
  'text/json': codecs.json.decode,
  'text/plain': codecs.text.decode,
};

exports.METHODS = [
  'options',
  'get',
  'head',
  'post',
  'put',
  'delete',
  'patch',
];

exports.MIME_ALIAS = {
  form: 'application/x-www-form-urlencoded',
  multipart: 'multipart/form-data',
  json: 'application/json',
  qs: 'application/x-www-form-urlencoded',
  querystring: 'application/x-www-form-urlencoded',
  text: 'text/plain',
};

exports.EXCLUDE_CONTENT_LENGTH = [
  'GET',
  'HEAD',
  'OPTIONS',
];

exports.CLIENT_OPTIONS = [
  'agent',
  'pfx',
  'key',
  'passphrase',
  'cert',
  'ca',
  'ciphers',
  'rejectUnauthorized',
  'secureProtocol',
];

exports.REQUEST_OPTIONS = exports.CLIENT_OPTIONS.concat([
  'method',
]);
