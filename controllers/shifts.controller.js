import { Op } from 'sequelize';
import { Shift, ShiftAssignment, SwapRequest, AuditLog, Location, Skill, User, UserLocation, UserSkill } from '../models/index.js';
import { logAudit } from '../utils/auditLogger.js';
import { notify } from '../utils/notificationHelper.js';
import { checkConstraints } from '../services/assignment.service.js';
import redisClient from '../config/redis.js';
import { swapQueue } from '../jobs/queues.js';
import { getIO } from '../sockets/index.js';

export async function createShift(req, res, next) {
  try {
    const { locationId, skillId, startUtc, endUtc, headcount, notes } = req.body;
    
    // Check permission if manager
    if (req.user.role === 'manager') {
      const ml = await req.user.managedLocations || []; // need to query if not in req.user
    }

    const shift = await Shift.create({ locationId, skillId, startUtc, endUtc, headcount, notes });
    console.log(shift);
    await logAudit(req.user.userId, 'Shift', shift.id, 'SHIFT_CREATED', null, shift.toJSON());
    
    res.status(201).json(shift);
  } catch (err) {
    console.error(err); 
    next(err);
  }
}

export async function getShifts(req, res, next) {
  try {
    const { locationId, startDate, endDate, published, staffId } = req.query;
    const where = {};
    if (locationId) where.locationId = locationId;
    if (published !== undefined) where.isPublished = published === 'true';
    if (startDate || endDate) {
      where.startUtc = {};
      if (startDate) where.startUtc[Op.gte] = new Date(startDate);
      if (endDate) where.startUtc[Op.lte] = new Date(endDate);
    }

    const include = [
      { 
        model: ShiftAssignment, 
        as: 'assignments',
        ...(staffId ? { where: { userId: staffId, status: 'assigned' } } : {})
      },
      { model: Skill, as: 'skill' }
    ];

    const shifts = await Shift.findAll({
      where,
      include
    });
    res.json(shifts);
  } catch (err) {
    next(err);
  }
}

export async function getShift(req, res, next) {
  try {
    const shift = await Shift.findByPk(req.params.id, {
      include: [
        { model: ShiftAssignment, as: 'assignments' }
      ]
    });
    if (!shift) return res.status(404).json({ error: 'NOT_FOUND', message: 'Shift not found' });
    res.json(shift);
  } catch (err) {
    next(err);
  }
}

export async function updateShift(req, res, next) {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ error: 'NOT_FOUND', message: 'Shift not found' });

    const before = shift.toJSON();
    const { locationId, skillId, startUtc, endUtc, headcount, notes, isPublished } = req.body;
    if (locationId !== undefined) shift.locationId = locationId;
    if (skillId !== undefined) shift.skillId = skillId;
    if (startUtc !== undefined) shift.startUtc = startUtc;
    if (endUtc !== undefined) shift.endUtc = endUtc;
    if (headcount !== undefined) shift.headcount = headcount;
    if (notes !== undefined) shift.notes = notes;
    if (isPublished !== undefined) shift.isPublished = isPublished;

    await shift.save();
    await logAudit(req.user.userId, 'Shift', shift.id, 'SHIFT_UPDATED', before, shift.toJSON());

    // If shift has swaps in PENDING_MANAGER, cancel them via Job
    const pendingSwaps = await SwapRequest.findAll({
      where: { shiftId: shift.id, status: 'PENDING_MANAGER' }
    });
    for (const swap of pendingSwaps) {
      await swapQueue.add('cancelSwapOnShiftEdit', {
        swapRequestId: swap.id,
        editedBy: req.user.userId
      });
    }

    const skill = await Skill.findByPk(shift.skillId);
    const roleName = skill ? skill.name : 'Shift';
    
    const assignments = await ShiftAssignment.findAll({
      where: { shiftId: shift.id, status: 'assigned' },
      include: [{ model: User, as: 'user' }]
    });

    const io = getIO();
    for (const ass of assignments) {
      const msg = `Your ${roleName} shift has been updated.`;
      await notify(ass.userId, 'SHIFT_UPDATED', msg, { shiftId: shift.id }, io);
      io.to(`user:${ass.userId}`).emit('shift_changed', {
        event: 'shift_changed',
        title: 'Shift Updated',
        message: msg,
        data: { shiftId: shift.id }
      });
    }

    res.json(shift);
  } catch (err) {
    next(err);
  }
}

export async function deleteShift(req, res, next) {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ error: 'NOT_FOUND', message: 'Shift not found' });

    const skill = await Skill.findByPk(shift.skillId);
    const roleName = skill ? skill.name : 'Shift';
    
    const assignments = await ShiftAssignment.findAll({
      where: { shiftId: shift.id, status: 'assigned' }
    });

    const io = getIO();
    for (const ass of assignments) {
      const msg = `Your ${roleName} shift has been cancelled.`;
      await notify(ass.userId, 'SHIFT_CANCELLED', msg, { locationId: shift.locationId }, io);
    }

    const before = shift.toJSON();
    await shift.destroy();
    await logAudit(req.user.userId, 'Shift', shift.id, 'SHIFT_DELETED', before, null);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function publishShift(req, res, next) {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ error: 'NOT_FOUND', message: 'Shift not found' });

    const before = shift.toJSON();
    shift.isPublished = true;
    await shift.save();

    await logAudit(req.user.userId, 'Shift', shift.id, 'SHIFT_PUBLISHED', before, shift.toJSON());

    const io = getIO();
    io.to(`location:${shift.locationId}`).emit('schedule_published', {
      event: 'schedule_published',
      title: 'Schedule Published',
      message: `The schedule for ${shift.locationId} has been published.`,
      data: { shiftId: shift.id, locationId: shift.locationId }
    });

    // Notify assigned staff
    const assignments = await ShiftAssignment.findAll({ where: { shiftId: shift.id, status: 'assigned' } });
    for (const assignment of assignments) {
      await notify(assignment.userId, 'SHIFT_PUBLISHED', 'A shift you are assigned to has been published.', { shiftId: shift.id }, io);
    }

    res.json(shift);
  } catch (err) {
    next(err);
  }
}

export async function unpublishShift(req, res, next) {
  try {
    const shift = await Shift.findByPk(req.params.id);
    if (!shift) return res.status(404).json({ error: 'NOT_FOUND', message: 'Shift not found' });

    const now = new Date();
    const cutoffDate = new Date(shift.startUtc.getTime() - shift.cutoffHours * 60 * 60 * 1000);
    
    if (now > cutoffDate) {
      return res.status(400).json({ error: 'PAST_CUTOFF', message: `Cannot unpublish within ${shift.cutoffHours} hours of start` });
    }

    const before = shift.toJSON();
    shift.isPublished = false;
    await shift.save();

    await logAudit(req.user.userId, 'Shift', shift.id, 'SHIFT_UNPUBLISHED', before, shift.toJSON());
    res.json(shift);
  } catch (err) {
    next(err);
  }
}

export async function getShiftHistory(req, res, next) {
  try {
    const logs = await AuditLog.findAll({
      where: { entityType: 'Shift', entityId: req.params.id },
      order: [['createdAt', 'DESC']]
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

export async function createAssignment(req, res, next) {
  const { userId, overrideReason } = req.body;
  const shiftId = req.params.id;
  const lockKey = `lock:staff:${userId}:assign`;
  
  try {
    // Acquire Redis lock with 100ms TTL
    const lock = await redisClient.set(lockKey, 'locked', 'NX', 'PX', 100);
    if (!lock) {
      return res.status(409).json({
        error: 'CONCURRENT_ASSIGNMENT',
        message: 'Another manager is currently assigning this person. Please try again.'
      });
    }

    try {
      const result = await checkConstraints(userId, shiftId, overrideReason);
      
      if (!result.allowed) {
        return res.status(422).json({
          error: 'constraint_violation',
          message: 'Assignment blocked by scheduling constraints.',
          violations: result.violations,
          warnings: result.warnings,
          requiresOverride: result.requiresOverride,
          overrideTarget: result.overrideTarget
        });
      }

      const assignment = await ShiftAssignment.create({
        shiftId,
        userId,
        status: 'assigned'
      });

      const auditData = overrideReason ? { overrideReason } : null;
      await logAudit(req.user.userId, 'ShiftAssignment', assignment.id, 'ASSIGNMENT_CREATED', null, { ...assignment.toJSON(), ...auditData });

      const shift = await Shift.findByPk(shiftId);
      const io = getIO();
      io.to(`user:${userId}`).emit('shift_assigned', {
        event: 'shift_assigned',
        title: 'New Shift Assigned',
        message: `You have been assigned to a shift on ${shift?.startUtc.toDateString()}.`,
        data: { shiftId, userId }
      });

      return res.status(201).json({
        assignment,
        warnings: result.warnings
      });
    } finally {
      // Release lock
      await redisClient.del(lockKey);
    }
  } catch (err) {
    next(err);
  }
}

export async function deleteAssignment(req, res, next) {
  try {
    const { id: shiftId, userId } = req.params;
    const assignment = await ShiftAssignment.findOne({ where: { shiftId, userId } });
    if (!assignment) return res.status(404).json({ error: 'NOT_FOUND', message: 'Assignment not found' });

    const before = assignment.toJSON();
    await assignment.destroy();
    await logAudit(req.user.userId, 'ShiftAssignment', assignment.id, 'ASSIGNMENT_DELETED', before, null);

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getEligibleStaff(req, res, next) {
  try {
    const shiftId = req.params.id;
    const { search } = req.query;
    const shift = await Shift.findByPk(shiftId);
    if (!shift) return res.status(404).json({ error: 'NOT_FOUND', message: 'Shift not found' });

    // Find all users who have the skill and location certification
    const userLocations = await UserLocation.findAll({ where: { locationId: shift.locationId } });
    const userSkills = await UserSkill.findAll({ where: { skillId: shift.skillId } });
    
    const locUserIds = userLocations.map(ul => ul.userId);
    const skillUserIds = userSkills.map(us => us.userId);
    const candidateIds = locUserIds.filter(id => skillUserIds.includes(id));

    // Filter by search criteria if provided
    const userWhere = { id: candidateIds };
    if (search) {
      userWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({ 
      where: userWhere,
      attributes: { exclude: ['passwordHash'] }
    });

    const eligible = [];
    for (const user of users) {
      const result = await checkConstraints(user.id, shiftId);
      
      const hasNonOverridableHardBlocks = result.violations.some(v => v.code !== 'DAILY_HOURS_BLOCK' && v.code !== 'CONSECUTIVE_DAY_BLOCK');
      
      if (!hasNonOverridableHardBlocks) {
        eligible.push({ 
          ...user.toJSON(), 
          warnings: result.warnings, 
          violations: result.violations,
          requiresOverride: result.requiresOverride 
        });
      }
    }

    res.json(eligible);
  } catch (err) {
    next(err);
  }
}
