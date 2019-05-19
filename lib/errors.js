'use strict';

/**
 * Create
 */

function create(message) {
  const error = message instanceof Error ?
    message :
    new Error(message ? message : undefined);

  error.isPapi = true;

  return error;
}

/**
 * Codec
 */

function codec(message) {
  const error = create(message);

  error.isCodec = true;

  return error;
}

/**
 * Response
 */

function response(message) {
  const error = create(message);

  error.isResponse = true;

  return error;
}

/**
 * Abort
 */

function abort(message) {
  const error = create(message);

  error.isAbort = true;

  return error;
}

/**
 * Timeout
 */

function timeout(message) {
  const error = create(message);

  error.isTimeout = true;

  return error;
}

/**
 * Validation
 */

function validation(message) {
  const error = create(message);

  error.isValidation = true;

  return error;
}

exports.Codec = codec;
exports.Response = response;
exports.Abort = abort;
exports.Timeout = timeout;
exports.Validation = validation;
exports.create = create;
