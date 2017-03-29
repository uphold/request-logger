'use strict';

/**
 * Module dependencies.
 */

const nock = require('nock');
const request = require('request');
const requestLogger = require('../.');

/**
 * Disable net connect.
 */

nock.disableNetConnect();

/**
 * Clean all mocks.
 */

beforeEach(() => {
  nock.cleanAll();
});

/**
 * Should not have pending mocks.
 */

afterEach(() => {
  expect(nock.pendingMocks()).toEqual([]);
});

/**
 * Dummy url.
 */

const url = 'http://foo.bar';

/**
 * `request-logger` testing.
 */

describe('request-logger', () => {
  it('should have the default log `console.error`', done => {
    spyOn(console, 'error');

    const client = requestLogger(request);

    nock(url).get('/').reply(200);

    client(url).on('response', () => {
      expect(console.error).toHaveBeenCalled();
      expect(console.error.calls.first().args[0]).toMatchObject({
        headers: {},
        method: 'GET',
        type: 'request',
        uri: 'http://foo.bar/'
      });

      done();
    });
  });

  it('should throw if `log` is not a function', () => {
    expect(() => requestLogger(request, 'foo')).toThrowError('Expected a function');
  });

  it('should generate a different id', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200);

    client(url).on('response', () => {
      expect(log.calls.mostRecent().args[0].id).toBeDefined();

      const id = log.calls.mostRecent().args[1].id;

      nock(url).get('/').reply(200);

      client(url).on('response', () => {
        expect(log.calls.mostRecent().args[0].id).toBeDefined();
        expect(log.calls.mostRecent().args[0].id).not.toEqual(id);

        done();
      });
    });
  });

  it('should not log a `complete` event if no callback was passed', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200, 'foo');

    client(url).on('complete', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        duration: expect.any(Number),
        headers: {},
        id: log.calls.mostRecent().args[0].id,
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      }));

      done();
    });
  });

  it('should log a `complete` event if a callback was passed', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200, 'foo');

    client(url, () => {}).on('complete', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        body: 'foo',
        duration: expect.any(Number),
        headers: {},
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      }));

      done();
    });
  });

  it('should log the request `duration`', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    spyOn(Date, 'now').and.returnValue(0);

    nock(url).get('/').reply(200, 'foo');

    client(url, () => {}).on('complete', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        body: 'foo',
        duration: 0,
        headers: {},
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      }));

      done();
    });
  });

  it('should log the elapsed time as `duration`', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').delay(500).reply(200, 'foo');

    client(url, () => {}).on('complete', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        body: 'foo',
        duration: expect.any(Number),
        headers: {},
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      }));
      expect(log.calls.mostRecent().args[0].duration).not.toBeLessThan(500);

      done();
    });
  });

  it('should log an `error` event', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').replyWithError('foo');

    client(url).on('error', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        duration: expect.any(Number),
        error: log.calls.mostRecent().args[0].error,
        headers: {
          host: 'foo.bar'
        },
        id: log.calls.mostRecent().args[0].id,
        method: 'GET',
        type: 'error',
        uri: 'http://foo.bar/'
      }));

      done();
    });
  });

  it('should log a `redirect` event', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);
    const redirectUrl = 'http://bar.foo/';

    nock(url).get('/').reply(302, undefined, { Location: redirectUrl });

    client(url).on('redirect', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        duration: expect.any(Number),
        headers: {
          location: redirectUrl
        },
        statusCode: 302,
        type: 'redirect',
        uri: redirectUrl
      }));

      done();
    });
  });

  it('should log a `request` event', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200, 'foo');

    client(url).on('request', () => {
      expect(log.calls.mostRecent().args[0]).toMatchObject({
        headers: {},
        id: log.calls.mostRecent().args[0].id,
        method: 'GET',
        type: 'request',
        uri: 'http://foo.bar/'
      });
    }).on('response', () => {
      done();
    });
  });

  it('should log a `request` event with body', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200);

    client({ body: 'foo', uri: url }).on('request', () => {
      expect(log.calls.mostRecent().args[0]).toMatchObject({
        body: 'foo',
        headers: {
          'content-length': 3
        },
        id: log.calls.mostRecent().args[0].id,
        method: 'GET',
        type: 'request',
        uri: 'http://foo.bar/'
      });
    }).on('response', () => {
      done();
    });
  });

  it('should log a `response` event if no callback was passed', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200);

    client(url).on('response', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        duration: expect.any(Number),
        headers: {},
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      }));

      done();
    });
  });

  it('should log the `response` body', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200, 'foo');

    client(url).on('response', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        duration: expect.any(Number),
        headers: {},
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      }));

      done();
    });
  });

  it('should not log a `response` event if a callback was passed', done => {
    const log = jasmine.createSpy();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200);

    client(url, () => {}).on('response', () => {
      expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
        headers: {},
        method: 'GET',
        type: 'request',
        uri: 'http://foo.bar/'
      }));

      done();
    });
  });

  it('should support calling with a callback argument', done => {
    const client = requestLogger(request, () => {});

    nock(url).get('/').reply(200, 'foo');

    client(url, (err, response) => {
      expect(response.body).toEqual('foo');
      expect(response.statusCode).toEqual(200);

      done();
    });
  });

  if (request.defaults) {
    it('should support calling with an instance of `defaults`', done => {
      const client = requestLogger(request, () => {}).defaults({ uri: url });

      nock(url).get('/').reply(200, 'foo');

      client({}, (err, response) => {
        expect(response.statusCode).toBe(200);

        done();
      });
    });
  }

  ['del', 'delete', 'get', 'head', 'patch', 'post', 'put'].forEach(verb => {
    // Only `request` versions 2.72.0+ have the `delete` method.
    if (verb === 'delete' && !request.delete) {
      return;
    }

    const method = verb === 'del' ? 'delete' : verb;

    describe(verb, () => {
      it(`should have the \`${verb}\` method`, () => {
        const client = requestLogger(request);

        expect(client[verb]).toBeInstanceOf(Function);
      });

      it('should generate a different id', done => {
        const log = jasmine.createSpy();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200);

        client[verb](url).on('response', () => {
          expect(log.calls.mostRecent().args[0].id).toBeDefined();

          const id = log.calls.mostRecent().args[1].id;

          nock(url)[method]('/').reply(200);

          client[verb](url).on('response', () => {
            expect(log.calls.mostRecent().args[0].id).toBeDefined();
            expect(log.calls.mostRecent().args[0].id).not.toBe(id);

            done();
          });
        });
      });

      it('should not log a `complete` event if no callback was passed', done => {
        const log = jasmine.createSpy();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200, 'foo');

        client[verb](url).on('complete', () => {
          expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
            headers: {},
            id: expect.any(String),
            statusCode: 200,
            type: 'response',
            uri: 'http://foo.bar/'
          }));

          done();
        });
      });

      it('should log a `complete` event if a callback was passed', done => {
        const log = jasmine.createSpy();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200, 'foo');

        client[verb](url, () => {}).on('complete', () => {
          expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
            body: 'foo',
            duration: expect.any(Number),
            headers: {},
            id: expect.any(String),
            statusCode: 200,
            type: 'response',
            uri: 'http://foo.bar/'
          }));

          done();
        });
      });

      it('should log an `error` event', done => {
        const log = jasmine.createSpy();
        const client = requestLogger(request, log);

        nock(url)[method]('/').replyWithError('foo');

        client[verb](url).on('error', () => {
          expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
            duration: expect.any(Number),
            error: new Error('foo'),
            id: expect.any(String),
            method: expect.any(String),
            type: 'error',
            uri: 'http://foo.bar/'
          }));

          done();
        });
      });

      if (verb === 'get') {
        it('should log a `redirect` event', done => {
          const log = jasmine.createSpy();
          const client = requestLogger(request, log);
          const redirectUrl = 'http://bar.foo/';

          nock(url)[method]('/').reply(302, undefined, { Location: redirectUrl });

          client[verb](url).on('redirect', () => {
            expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
              duration: expect.any(Number),
              headers: {
                location: redirectUrl
              },
              id: expect.any(String),
              statusCode: 302,
              type: 'redirect',
              uri: redirectUrl
            }));

            done();
          });
        });
      }

      it('should log a `request` event', done => {
        const log = jasmine.createSpy();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200);

        client[verb](url).on('request', () => {
          expect(log.calls.mostRecent().args[0]).toMatchObject({
            headers: {},
            type: 'request',
            uri: 'http://foo.bar/'
          });
          expect(log.calls.mostRecent().args[0].id).toBeDefined();
          expect(log.calls.mostRecent().args[0].method).toBeDefined();
        }).on('response', () => {
          done();
        });
      });

      // Method HEAD cannot receive a body.
      if (verb !== 'head') {
        it('should log a `request` event with body', done => {
          const log = jasmine.createSpy();
          const client = requestLogger(request, log);

          nock(url)[method]('/').reply(200);

          client[verb]({ body: 'foo', uri: url }).on('request', () => {
            expect(log.calls.mostRecent().args[0]).toMatchObject({
              body: 'foo',
              headers: {
                'content-length': 3
              },
              type: 'request',
              uri: 'http://foo.bar/'
            });
            expect(log.calls.mostRecent().args[0].id).toBeDefined();
            expect(log.calls.mostRecent().args[0].method).toBeDefined();
          }).on('response', () => {
            // Only in response the nock is called.
            done();
          });
        });
      }

      it('should log a `response` event if no callback was passed', done => {
        const log = jasmine.createSpy();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200);

        client[verb](url).on('response', () => {
          expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
            duration: expect.any(Number),
            headers: {},
            id: expect.any(String),
            statusCode: 200,
            type: 'response',
            uri: 'http://foo.bar/'
          }));

          done();
        });
      });

      it('should not log a `response` event if a callback was passed', done => {
        const log = jasmine.createSpy();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200);

        client[verb](url, () => {}).on('response', () => {
          expect(log.calls.mostRecent().args[0]).toEqual(expect.objectContaining({
            id: expect.any(String),
            method: expect.any(String),
            type: 'request',
            uri: 'http://foo.bar/'
          }));

          done();
        });
      });

      it('should support calling with a callback argument', done => {
        const client = requestLogger(request, () => {});

        nock(url)[method]('/').reply(200, 'foo');

        client[verb](url, (err, response) => {
          expect(response).toMatchObject({
            body: 'foo',
            headers: {},
            statusCode: 200
          });

          done();
        });
      });

      if (request.defaults) {
        it('should support calling with an instance of `defaults`', done => {
          const client = requestLogger(request, () => {}).defaults({ uri: url });

          nock(url)[method]('/').reply(200, 'foo');

          client[verb]({}, (err, response) => {
            expect(response).toMatchObject({
              body: 'foo',
              headers: {},
              statusCode: 200
            });

            done();
          });
        });
      }
    });
  });
});
