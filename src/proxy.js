'use strict';

/**
 * Module dependencies.
 */

const fs = require('node:fs');
const vm = require('node:vm');

/**
 * Proxy reference.
 */

let { Proxy } = global;

/**
 * Workaround to avoid mutating `global.Proxy`.
 */

if (!Proxy) {
  const context = { self: {} };

  vm.runInNewContext(fs.readFileSync(`${__dirname}/../vendor/proxy-polyfill.js`).toString(), context);

  Proxy = context.self.Proxy;
}

/**
 * Exports.
 */

module.exports = Proxy;
