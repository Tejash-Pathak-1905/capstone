const { notFoundHandler, errorHandler } = require('../src/middleware/errorHandler');

describe('Global Error Handling Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      originalUrl: '/api/test-route',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test('notFoundHandler returns 404 with structured error message', () => {
    notFoundHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Route not found: GET /api/test-route',
    });
  });

  test('errorHandler maps PostgreSQL unique constraint violation (code 23505) to 409 Conflict', () => {
    const error = new Error('duplicate key value violates unique constraint');
    error.code = '23505';

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('already exists'),
      })
    );
  });

  test('errorHandler maps Mongoose CastError (invalid ObjectId format) to 400 Bad Request', () => {
    const error = new Error('Cast to ObjectId failed');
    error.name = 'CastError';

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid identifier format',
    });
  });

  test('errorHandler respects custom status and statusCode properties', () => {
    const customError = new Error('Custom forbidden action');
    customError.status = 403;

    errorHandler(customError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Custom forbidden action',
      })
    );
  });

  test('errorHandler defaults generic unhandled errors to 500', () => {
    const genericError = new Error('Something broke');

    errorHandler(genericError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Something broke',
      })
    );
  });
});
