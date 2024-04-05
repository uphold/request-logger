'use strict';

/**
 * Module dependencies.
 */

const nock = require('nock');
const request = require('@cypress/request');
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
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * `request-logger` testing.
 */

describe('request-logger', () => {
  it('should have the default log `console.error`', done => {
    jest.spyOn(console, 'error').mockImplementation();

    const client = requestLogger(request);

    nock(url).get('/').reply(200);

    client(url).on('response', () => {
      try {
        expect(console.error).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith({
          headers: {},
          id: expect.stringMatching(uuidRegex),
          method: 'GET',
          type: 'request',
          uri: 'http://foo.bar/'
        });

        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should throw if `log` is not a function', () => {
    expect(() => requestLogger(request, 'foo')).toThrowError('Expected a function');
  });

  it('should generate a different id', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200);

    client(url).on('response', () => {
      const [{ id }] = log.mock.lastCall;

      nock(url).get('/').reply(200);

      client(url).on('response', () => {
        expect(log.mock.lastCall[0].id).not.toEqual(id);

        done();
      });
    });
  });

  it('should not log a `complete` event if no callback was passed', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200, 'foo');

    client(url).on('complete', () => {
      expect(log.mock.lastCall[0]).toMatchObject({
        duration: expect.any(Number),
        headers: {},
        id: expect.stringMatching(uuidRegex),
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      });

      done();
    });
  });

  it('should log a `complete` event if a callback was passed', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200, 'foo');

    client(url, () => {}).on('complete', () => {
      expect(log.mock.lastCall[0]).toMatchObject({
        body: 'foo',
        duration: expect.any(Number),
        headers: {},
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      });

      done();
    });
  });

  it('should log the request `duration`', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    jest.spyOn(Date, 'now').mockReturnValue(0);

    nock(url).get('/').reply(200, 'foo');

    client(url, () => {}).on('complete', () => {
      expect(log.mock.lastCall[0]).toMatchObject({
        body: 'foo',
        duration: 0,
        headers: {},
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      });

      done();
    });
  });

  it('should log the elapsed time as `duration`', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').delay(500).reply(200, 'foo');

    client(`${url}/`, () => {}).on('complete', () => {
      try {
        expect(log.mock.lastCall[0]).toMatchObject({
          body: 'foo',
          duration: expect.any(Number),
          headers: {},
          statusCode: 200,
          type: 'response',
          uri: 'http://foo.bar/'
        });
        expect(log.mock.lastCall[0].duration).not.toBeLessThan(500);

        done();
      } catch (error) {
        done(error);
      }
    });
  });

  it('should log an `error` event', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').replyWithError('foo');

    client(url).on('error', () => {
      expect(log.mock.lastCall[0]).toMatchObject({
        duration: expect.any(Number),
        error: log.mock.lastCall[0].error,
        headers: {
          host: 'foo.bar'
        },
        id: expect.stringMatching(uuidRegex),
        method: 'GET',
        type: 'error',
        uri: 'http://foo.bar/'
      });

      done();
    });
  });

  it('should log a `redirect` event', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);
    const redirectUrl = 'http://bar.foo/';

    nock(url).get('/').reply(302, undefined, { Location: redirectUrl });

    client(url).on('redirect', () => {
      expect(log.mock.lastCall[0]).toMatchObject({
        duration: expect.any(Number),
        headers: {
          location: redirectUrl
        },
        statusCode: 302,
        type: 'redirect',
        uri: redirectUrl
      });

      done();
    });
  });

  it('should log a `request` event', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200, 'foo');

    client(url)
      .on('request', () => {
        expect(log.mock.lastCall[0]).toMatchObject({
          headers: {},
          id: expect.stringMatching(uuidRegex),
          method: 'GET',
          type: 'request',
          uri: 'http://foo.bar/'
        });
      })
      .on('response', () => {
        done();
      });
  });

  it('should log a `request` event with body', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200);

    client({ body: 'foo', uri: url })
      .on('request', () => {
        expect(log.mock.lastCall[0]).toMatchObject({
          body: 'foo',
          headers: {
            'content-length': 3
          },
          id: expect.stringMatching(uuidRegex),
          method: 'GET',
          type: 'request',
          uri: 'http://foo.bar/'
        });
      })
      .on('response', () => {
        done();
      });
  });

  it('should log a `response` event if no callback was passed', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200);

    client(url).on('response', () => {
      expect(log.mock.lastCall[0]).toMatchObject({
        duration: expect.any(Number),
        headers: {},
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      });

      done();
    });
  });

  it('should log the `response` body', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200, 'foo');

    client(url).on('response', () => {
      expect(log.mock.lastCall[0]).toMatchObject({
        duration: expect.any(Number),
        headers: {},
        id: expect.stringMatching(uuidRegex),
        statusCode: 200,
        type: 'response',
        uri: 'http://foo.bar/'
      });

      done();
    });
  });

  it('should not log a `response` event if a callback was passed', done => {
    const log = jest.fn();
    const client = requestLogger(request, log);

    nock(url).get('/').reply(200);

    client(url, () => {}).on('response', () => {
      expect(log.mock.lastCall[0]).toMatchObject({
        headers: {},
        method: 'GET',
        type: 'request',
        uri: 'http://foo.bar/'
      });

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
        const log = jest.fn();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200);

        client[verb](url).on('response', () => {
          expect(log.mock.lastCall[0].id).toBeDefined();

          const [{ id }] = log.mock.lastCall;

          nock(url)[method]('/').reply(200);

          client[verb](url).on('response', () => {
            expect(log.mock.lastCall[0].id).toBeDefined();
            expect(log.mock.lastCall[0].id).not.toBe(id);

            done();
          });
        });
      });

      it('should not log a `complete` event if no callback was passed', done => {
        const log = jest.fn();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200, 'foo');

        client[verb](url).on('complete', () => {
          expect(log.mock.lastCall[0]).toMatchObject({
            headers: expect.any(Object),
            id: expect.stringMatching(uuidRegex),
            statusCode: 200,
            type: 'response',
            uri: 'http://foo.bar/'
          });

          done();
        });
      });

      it('should log a `complete` event if a callback was passed', done => {
        const log = jest.fn();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200, 'foo');

        client[verb](url, () => {}).on('complete', () => {
          expect(log.mock.lastCall[0]).toMatchObject({
            body: 'foo',
            duration: expect.any(Number),
            headers: {},
            id: expect.stringMatching(uuidRegex),
            statusCode: 200,
            type: 'response',
            uri: 'http://foo.bar/'
          });

          done();
        });
      });

      it('should log an `error` event', done => {
        const log = jest.fn();
        const client = requestLogger(request, log);

        nock(url)[method]('/').replyWithError('foo');

        client[verb](url).on('error', () => {
          expect(log.mock.lastCall[0]).toMatchObject({
            duration: expect.any(Number),
            error: new Error('foo'),
            id: expect.stringMatching(uuidRegex),
            method: expect.any(String),
            type: 'error',
            uri: 'http://foo.bar/'
          });

          done();
        });
      });

      if (verb === 'get') {
        it('should log a `redirect` event', done => {
          const log = jest.fn();
          const client = requestLogger(request, log);
          const redirectUrl = 'http://bar.foo/';

          nock(url)[method]('/').reply(302, undefined, { Location: redirectUrl });

          client[verb](url).on('redirect', () => {
            expect(log.mock.lastCall[0]).toMatchObject({
              duration: expect.any(Number),
              headers: {
                location: redirectUrl
              },
              id: expect.stringMatching(uuidRegex),
              statusCode: 302,
              type: 'redirect',
              uri: redirectUrl
            });

            done();
          });
        });
      }

      it('should log a `request` event', done => {
        const log = jest.fn();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200);

        client[verb](url)
          .on('request', () => {
            expect(log.mock.lastCall[0]).toMatchObject({
              headers: {},
              type: 'request',
              uri: 'http://foo.bar/'
            });
            expect(log.mock.lastCall[0].id).toBeDefined();
            expect(log.mock.lastCall[0].method).toBeDefined();
          })
          .on('response', () => {
            done();
          });
      });

      // Method HEAD cannot receive a body.
      if (verb !== 'head') {
        it('should log a `request` event with body', done => {
          const log = jest.fn();
          const client = requestLogger(request, log);

          nock(url)[method]('/').reply(200);

          client[verb]({ body: 'foo', uri: url })
            .on('request', () => {
              expect(log.mock.lastCall[0]).toMatchObject({
                body: 'foo',
                headers: {
                  'content-length': 3
                },
                type: 'request',
                uri: 'http://foo.bar/'
              });
              expect(log.mock.lastCall[0].id).toBeDefined();
              expect(log.mock.lastCall[0].method).toBeDefined();
            })
            .on('response', () => {
              // Only in response the nock is called.
              done();
            });
        });
      }

      it('should log a `response` event if no callback was passed', done => {
        const log = jest.fn();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200);

        client[verb](url).on('response', () => {
          expect(log.mock.lastCall[0]).toMatchObject({
            duration: expect.any(Number),
            headers: {},
            id: expect.stringMatching(uuidRegex),
            statusCode: 200,
            type: 'response',
            uri: 'http://foo.bar/'
          });

          done();
        });
      });

      it('should not log a `response` event if a callback was passed', done => {
        const log = jest.fn();
        const client = requestLogger(request, log);

        nock(url)[method]('/').reply(200);

        client[verb](url, () => {}).on('response', () => {
          expect(log.mock.lastCall[0]).toMatchObject({
            id: expect.stringMatching(uuidRegex),
            method: expect.any(String),
            type: 'request',
            uri: 'http://foo.bar/'
          });

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
