import { validationResult } from 'express-validator';

export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'One or more fields failed validation',
      details: errors.array().reduce((acc, err) => {
        acc[err.path] = err.msg;
        return acc;
      }, {})
    });
  }
  next();
}
