'use strict';

/**
 * Check if object is empty
 */

function isEmpty(obj) {
  if (!obj) return true;

  for (let p in obj) {
    if (obj.hasOwnProperty(p)) return false;
  }

  return true;
}

/**
 * Check stream
 */

function isStream(s) {
  return s !== null &&
    typeof s === 'object' &&
    typeof s.pipe === 'function';
}

/**
 * Check readable stream
 */

function isReadableStream(s) {
  return isStream(s) && s.readable !== false;
}

/**
 * Check writiable stream
 */

function isWritableStream(s) {
  return isStream(s) && s.writable !== false;
}

/**
 * Merge in objects
 */

function merge() {
  const data = {};

  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i];

    if (arg != null) {
      for (const key in arg) {
        if (Object.prototype.hasOwnProperty.call(arg, key)) {
          data[key] = arg[key];
        }
      }
    }
  }

  return data;
}

/**
 * Merge headers
 */

function mergeHeaders() {
  const data = {};

  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i];

    if (arg != null) {
      for (const key in arg) {
        if (Object.prototype.hasOwnProperty.call(arg, key)) {
          data[key.toLowerCase()] = arg[key];
        }
      }
    }
  }

  return data;
}

/**
 * Create a shallow copy of obj composed of the specified properties.
 */

function pick(obj) {
  let args = arguments;
  let start = 1;

  if (args.length === 2 && Array.isArray(args[1])) {
    args = args[1];
    start = 0;
  }

  const data = {};

  for (let i = start; i < args.length; i++) {
    const key = args[i];

    if (obj.hasOwnProperty(key)) {
      data[key] = obj[key];
    }
  }

  return data;
}

exports.isEmpty = isEmpty;
exports.isReadableStream = isReadableStream;
exports.isWritableStream = isWritableStream;
exports.merge = merge;
exports.mergeHeaders = mergeHeaders;
exports.pick = pick;
