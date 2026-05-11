import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, RefreshToken, UserSkill, UserLocation, Location, Skill } from '../models/index.js';
import { AuthError, ValidationError } from '../middleware/errorHandler.js';
import * as reportingService from '../services/reporting.service.js';
import * as leaveService from '../services/leave.service.js';

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: parseInt(process.env.JWT_ACCESS_TTL || '900') }
  );

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + parseInt(process.env.JWT_REFRESH_TTL || '604800') * 1000);

  return { accessToken, refreshToken, expiresAt };
};

export async function register(req, res, next) {
  try {
    const { name, email, password, role, skills, locations } = req.body;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ValidationError('Email already in use');
    }

    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await User.create({
      name,
      email,
      passwordHash,
      role
    });

    // Add skills if provided
    if (skills && Array.isArray(skills)) {
      for (const skillId of skills) {
        await UserSkill.create({ userId: user.id, skillId });
      }
    }

    // Add locations if provided
    if (locations && Array.isArray(locations)) {
      for (const locationId of locations) {
        await UserLocation.create({ userId: user.id, locationId });
      }
    }

    try {
      const actorId = req.user ? req.user.userId : user.id;
      await reportingService.onStaffCreated(user.id, actorId);
      
      if (user.role === 'staff') {
        await leaveService.seedDefaultAvailability(user.id);
      }
    } catch (hookErr) {
      console.error('[registration-hooks] failed:', hookErr);
    }

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ 
      where: { email },
      include: [
        { model: Location, as: 'certifiedLocations', through: { attributes: [] } },
        { model: Location, as: 'managedLocations', through: { attributes: [] } },
        { model: Skill, as: 'skills', through: { attributes: [] } }
      ]
    });
    if (!user) {
      throw new AuthError('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AuthError('Invalid email or password');
    }

    const { accessToken, refreshToken, expiresAt } = generateTokens(user);

    await RefreshToken.create({
      userId: user.id,
      token: refreshToken,
      expiresAt
    });

    const userResponse = user.toJSON();
    delete userResponse.passwordHash;

    res.json({ 
      accessToken, 
      refreshToken, 
      user: userResponse,
      managedLocations: user.managedLocations.map(l => l.id),
      certifiedLocations: user.certifiedLocations.map(l => l.id)
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    const tokenRecord = await RefreshToken.findOne({ 
      where: { token: refreshToken },
      include: [{ 
        model: User, 
        as: 'user',
        include: [
          { model: Location, as: 'certifiedLocations', through: { attributes: [] } },
          { model: Location, as: 'managedLocations', through: { attributes: [] } },
          { model: Skill, as: 'skills', through: { attributes: [] } }
        ]
      }]
    });

    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      throw new AuthError('Invalid or expired refresh token');
    }

    const user = tokenRecord.user;
    const { accessToken, refreshToken: newRefreshToken, expiresAt } = generateTokens(user);

    // Revoke old token
    tokenRecord.revoked = true;
    await tokenRecord.save();

    // Create new token
    await RefreshToken.create({
      userId: user.id,
      token: newRefreshToken,
      expiresAt
    });

    res.json({ 
      accessToken, 
      refreshToken: newRefreshToken,
      managedLocations: user.managedLocations.map(l => l.id),
      certifiedLocations: user.certifiedLocations.map(l => l.id)
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const tokenRecord = await RefreshToken.findOne({ where: { token: refreshToken } });
      if (tokenRecord) {
        tokenRecord.revoked = true;
        await tokenRecord.save();
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}
