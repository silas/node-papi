'use strict';

const util = require('util');

/**
 * Walk "standard" library
 */

function walk(obj, name, tree) {
  switch (arguments.length) {
    case 1:
      name = obj.name;
      tree = { name: name };
      break;
    case 2:
      tree = { name: name };
      break;
    case 3:
      break;
    default:
      throw new Error('invalid arguments');
  }

  Object.getOwnPropertyNames(obj.prototype).forEach(key => {
    if (key === 'constructor') return;

    const v = obj.prototype[key];

    if (!key.match(/^[a-z]+/)) return;
    if (!tree.methods) tree.methods = {};

    tree.methods[key] = {
      name: key,
      value: v,
    };

    const meta = obj.meta || {};

    tree.methods[key].type = meta[key] && meta[key].type || 'promise';
  });

  Object.keys(obj).forEach(key => {
    const v = obj[key];

    if (!key.match(/^[A-Z]+/)) return;
    if (!tree.objects) tree.objects = {};

    tree.objects[key] = {
      name: key,
      value: v,
    };

    walk(v, key, tree.objects[key]);
  });

  return tree;
}

/**
 * Converts promise methods to callbacks
 */

function callbackify(client) {
  if (!client) throw new Error('client required');

  const patch = (client, tree) => {
    Object.keys(tree.methods).forEach((key) => {
      const method = tree.methods[key];
      const fn = client[method.name];

      if (method.type === 'promise') {
        client[method.name] = util.callbackify(fn);
      }
    });

    if (tree.objects) {
      Object.keys(tree.objects).forEach((key) => {
        const clientKey = key[0].toLowerCase() + key.slice(1);
        patch(client[clientKey], tree.objects[key]);
      });
    }
  };

  patch(client, walk(client.constructor));
}

exports.callbackify = callbackify;
exports.walk = walk;
