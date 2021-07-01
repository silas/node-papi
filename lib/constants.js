'use strict';

const codecs = require('./codecs');

exports.CHARSET = 'utf-8';

exports.ENCODERS = Object.freeze({
  'application/json': codecs.json.encode,
  'application/x-www-form-urlencoded': codecs.form.encode,
  'text/plain': codecs.text.encode,
});

exports.DECODERS = Object.freeze({
  'application/json': codecs.json.decode,
  'application/x-www-form-urlencoded': codecs.form.decode,
  'text/html': codecs.text.decode,
  'text/json': codecs.json.decode,
  'text/plain': codecs.text.decode,
});

exports.MIME_ALIAS = Object.freeze({
  form: 'application/x-www-form-urlencoded',
  json: 'application/json',
  qs: 'application/x-www-form-urlencoded',
  querystring: 'application/x-www-form-urlencoded',
  text: 'text/plain',
});

exports.EXCLUDE_CONTENT_LENGTH = Object.freeze([
  'GET',
  'HEAD',
  'OPTIONS',
]);

exports.CLIENT_OPTIONS = Object.freeze([
  'agent',
  'createConnection',
  'family',
  'hints',
  'localAddress',
  'localPort',
  'lookup',
  'maxHeaderSize',
  'setHost',
  'socketPath',
  // tls
  'ca',
  'cert',
  'ciphers',
  'clientCertEngine',
  'crl',
  'dhparam',
  'ecdhCurve',
  'honorCipherOrder',
  'key',
  'passphrase',
  'pfx',
  'rejectUnauthorized',
  'secureOptions',
  'secureProtocol',
  'servername',
  'sessionIdContext',
]);

exports.REQUEST_OPTIONS = Object.freeze(exports.CLIENT_OPTIONS.concat([
  'method',
]));
