/**
 * Helper functions
 */

'use strict';

/**
 * Check if object is empty
 */

function isEmpty(obj) {
  if (!obj) return true;

  for (var p in obj) {
    if (obj.hasOwnProperty(p)) return false;
  }

  return true;
}

/**
 * Merge in objects
 */

function merge() {
  var data = {};

  if (!arguments.length) return data;

  var args = Array.prototype.slice.call(arguments, 0);

  args.forEach(function(obj) {
    if (!obj) return;

    Object.keys(obj).forEach(function(key) {
      data[key] = obj[key];
    });
  });

  return data;
}

/**
 * Merge headers
 */

function mergeHeaders() {
  var data = {};

  if (!arguments.length) return data;

  var args = Array.prototype.slice.call(arguments, 0);

  args.forEach(function(obj) {
    if (!obj) return;

    Object.keys(obj).forEach(function(key) {
      data[key.toLowerCase()] = obj[key];
    });
  });

  return data;
}

/**
 * Create a shallow copy of obj composed of the specified properties.
 */

function pick(obj) {
  var args = Array.prototype.slice.call(arguments);
  args.shift();

  if (args.length === 1 && Array.isArray(args[0])) {
    args = args[0];
  }

  var result = {};

  args.forEach(function(name) {
    if (obj.hasOwnProperty(name)) {
      result[name] = obj[name];
    }
  });

  return result;
}

/**
 * Normalize request arguments
 */

function requestArgs() {
  var arg;

  var args = {};
  var i = arguments.length <= 3 ? arguments.length : 3;

  while (--i >= 0) {
    arg = arguments[i];

    switch (typeof arg) {
      case 'function':
        args.callback = arg;
        break;
      case 'object':
        args.opts = arg;
        break;
      case 'string':
        args.path = arg;
        break;
    }
  }

  if (!args.opts) args.opts = {};

  return args;
}

/**
 * Module Exports.
 */

exports.isEmpty = isEmpty;
exports.merge = merge;
exports.mergeHeaders = mergeHeaders;
exports.pick = pick;
exports.requestArgs = requestArgs;
