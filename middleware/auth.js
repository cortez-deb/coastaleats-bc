import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token expired or invalid' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have permission to perform this action' });
    }
    next();
  };
}

export function requireSelfOrAdmin(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
    }
    if (req.user.role === 'admin') {
      return next();
    }
    const targetId = req.params[paramName];
    if (req.user.userId === targetId) {
      return next();
    }
    return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only access your own resources' });
  };
}
