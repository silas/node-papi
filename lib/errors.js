'use strict';

class PapiError extends Error {
  constructor(message) {
    if (message instanceof Error) {
      super(message.message);
      this.cause = message;
    } else {
      super(message);
    }

    this.isPapi = true;
  }
}

class CodecError extends PapiError {
  constructor(message) {
    super(message);

    this.isCodec = true;
  }
}

class ResponseError extends PapiError {
  constructor(message, response) {
    super(message);

    this.isResponse = true;

    this.response = response;
  }

  get statusCode() {
    return this.response.statusCode;
  }
}

class AbortError extends PapiError {
  constructor(message) {
    super(message);

    this.isAbort = true;
  }
}

class TimeoutError extends PapiError {
  constructor(message) {
    super(message);

    this.isTimeout = true;
  }
}

class ValidationError extends PapiError {
  constructor(message) {
    super(message);

    this.isValidation = true;
  }
}

exports.PapiError = PapiError;
exports.CodecError = CodecError;
exports.ResponseError = ResponseError;
exports.AbortError = AbortError;
exports.TimeoutError = TimeoutError;
exports.ValidationError = ValidationError;
