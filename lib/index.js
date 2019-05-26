'use strict';

const Client = require('./client').Client;
const codecs = require('./codecs');
const errors = require('./errors');
const shortcuts = require('./shortcuts');
const tools = require('./tools');

exports.Client = Client;

exports.PapiError = errors.PapiError;
exports.CodecError = errors.CodecError;
exports.ResponseError = errors.ResponseError;
exports.AbortError = errors.AbortError;
exports.TimeoutError = errors.TimeoutError;
exports.ValidationError = errors.ValidationError;

exports.request = shortcuts.request;
exports.get = shortcuts.method('GET');
exports.head = shortcuts.method('HEAD');
exports.post = shortcuts.method('POST');
exports.put = shortcuts.method('PUT');
exports.del = exports['delete'] = shortcuts.method('DELETE');
exports.patch = shortcuts.method('PATCH');

exports.codecs = codecs;
exports.tools = tools;
