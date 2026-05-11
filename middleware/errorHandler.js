export function errorHandler(err, req, res, next) {
  console.error('Unhandled Error:', err);

  const status = err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred';
  const details = err.details || {};

  // Handle specific known error shapes that didn't have status set
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'CONFLICT',
      message: 'A record with this unique identifier already exists',
      details: err.errors ? err.errors.map(e => e.message) : {}
    });
  }

  res.status(status).json({
    error: errorCode,
    message,
    details
  });
}

// Custom error classes for convenience
export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.status = 401;
    this.code = 'UNAUTHORIZED';
  }
}

export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ForbiddenError';
    this.status = 403;
    this.code = 'FORBIDDEN';
  }
}

export class ConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ConflictError';
    this.status = 409;
    this.code = 'CONFLICT';
    this.details = details;
  }
}

export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.status = 422;
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}
