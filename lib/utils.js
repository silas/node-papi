/**
 * Helper functions
 */

'use strict';

var http = require('http');
var stream = require('stream');

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
 * Check readable stream
 */

function isReadableStream(s) {
  return s instanceof stream.Readable;
}

/**
 * Check writiable stream
 */

function isWritableStream(s) {
  return s instanceof stream.Writable || s instanceof http.ServerResponse;
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
 * Module exports.
 */

exports.isEmpty = isEmpty;
exports.isReadableStream = isReadableStream;
exports.isWritableStream = isWritableStream;
exports.merge = merge;
exports.mergeHeaders = mergeHeaders;
exports.pick = pick;
