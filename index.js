'use strict';

/**
 * Module dependencies.
 */

const clone = require('lodash.clonedeep');
const uuid = require('uuid/v4');

/**
 * Exports
 */

module.exports = function logger(request, log = data => console.error(data)) {
  function apply(target, caller, args) {
    const id = uuid();

    return target(...args)
      .on('complete', function(response) {
        if (!this.callback) {
          return;
        }

        log({
          id,
          response: {
            body: response.body,
            headers: clone(response.headers),
            statusCode: response.statusCode
          },
          type: 'response',
          uri: this.uri.href
        }, this);
      }).on('error', function(error) {
        log({
          error,
          headers: clone(this.headers),
          id,
          method: this.method.toUpperCase(),
          type: 'error',
          uri: this.uri.href
        }, this);
      }).on('redirect', function() {
        log({
          id,
          response: {
            headers: clone(this.response.headers),
            statusCode: this.response.statusCode
          },
          type: 'redirect',
          uri: this.uri.href
        }, this);
      }).on('request', function() {
        const data = {
          headers: clone(this.headers),
          id,
          method: this.method,
          type: 'request',
          uri: this.uri.href
        };

        if (this.body) {
          data.body = this.body.toString('utf8');
        }

        log(data, this);
      }).on('response', function(response) {
        if (this.callback) {
          return;
        }

        log({
          id,
          response: {
            headers: clone(response.headers),
            statusCode: response.statusCode
          },
          type: 'response',
          uri: this.uri.href
        }, this);
      });
  }

  return new Proxy(request, {
    apply,
    get(target, name) {
      if (['del', 'delete', 'get', 'head', 'patch', 'post', 'put'].includes(name)) {
        return new Proxy(target[name], { apply });
      }

      return target[name];
    }
  });
};
