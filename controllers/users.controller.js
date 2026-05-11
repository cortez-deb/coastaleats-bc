import { 
  User, Availability, AvailabilityException, Skill, Location, UserSkill, UserLocation, 
  ManagerLocation, ShiftAssignment, SwapRequest 
} from '../models/index.js';
import { logAudit } from '../utils/auditLogger.js';
import { notify } from '../utils/notificationHelper.js';
import { getIO } from '../sockets/index.js';
import * as reportingService from '../services/reporting.service.js';
import { ReportingHistory } from '../models/index.js';

export async function getAllUsers(req, res, next) {
  try {
    const includeConfig = [
      { model: Location, as: 'certifiedLocations' },
      { model: Location, as: 'managedLocations' },
      { model: Skill, as: 'skills' },
      { model: User, as: 'manager', attributes: ['id', 'name'], required: false }
    ];

    let users = await User.findAll({
      attributes: { exclude: ['passwordHash'] },
      include: includeConfig
    });

    if (req.user.role === 'admin') {
      // Admin sees everyone, no filtering needed
    } else if (req.user.role === 'manager') {
      const managerLocs = await ManagerLocation.findAll({ where: { userId: req.user.userId } });
      const managerLocIds = managerLocs.map(ml => ml.locationId);

      users = users.filter(u => {
        if (u.id === req.user.userId) return true;
        const certLocIds = u.certifiedLocations.map(cl => cl.id);
        return certLocIds.some(id => managerLocIds.includes(id));
      });
    } else {
      // Staff
      const staffLocs = await UserLocation.findAll({ where: { userId: req.user.userId } });
      const staffLocIds = staffLocs.map(sl => sl.locationId);

      users = users.filter(u => {
        if (u.id === req.user.userId) return true;
        const certLocIds = u.certifiedLocations.map(cl => cl.id);
        return certLocIds.some(id => staffLocIds.includes(id));
      });
    }

    res.json(users);
  } catch (err) {
    next(err);
  }
}

export async function getUser(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        { model: User, as: 'manager', attributes: ['id', 'name', 'email'] },
        { 
          model: ReportingHistory,
          as: 'reportingHistory',
          where: { supersededAt: null },
          required: false,
          include: [{ model: User, as: 'assignedBy', attributes: ['id', 'name'] }]
        }
      ]
    });
    if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { name, email, role, desiredHours, notifyInApp, notifyEmail, skills, locations, isActive, phone, hireDate } = req.body;
    const userId = req.params.id;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });

    const before = user.toJSON();
    const isAdmin = req.user.role === 'admin';
    const isManager = req.user.role === 'manager';

    // Permission check for manager
    let managedLocIds = [];
    if (isManager) {
      const mls = await ManagerLocation.findAll({ where: { userId: req.user.userId } });
      managedLocIds = mls.map(ml => ml.locationId);
      
      const uls = await UserLocation.findAll({ where: { userId } });
      const userLocIds = uls.map(ul => ul.locationId);
      
      const hasOverlap = userLocIds.some(id => managedLocIds.includes(id));
      if (!isAdmin && !hasOverlap) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not manage this user' });
      }
    }

    // Only Admin can change core fields
    if (isAdmin) {
      if (name !== undefined) user.name = name;
      if (email !== undefined) user.email = email;
      if (role !== undefined) user.role = role;
    }

    // Common fields
    if (desiredHours !== undefined) user.desiredHours = desiredHours;
    if (notifyInApp !== undefined) user.notifyInApp = notifyInApp;
    if (notifyEmail !== undefined) user.notifyEmail = notifyEmail;
    if (isActive !== undefined) user.isActive = isActive;
    if (phone !== undefined) user.phone = phone;
    if (hireDate !== undefined) user.hireDate = hireDate;

    await user.save();

    // Sync skills (Admin or Manager of user's location)
    if (skills && Array.isArray(skills)) {
      if (isAdmin) {
        await UserSkill.destroy({ where: { userId: user.id } });
        for (const skillId of skills) {
          await UserSkill.create({ userId: user.id, skillId });
        }
      } else if (isManager) {
        // Managers can only manage skills if they manage the user
        // (already checked hasOverlap above)
        await UserSkill.destroy({ where: { userId: user.id } });
        for (const skillId of skills) {
          await UserSkill.create({ userId: user.id, skillId });
        }
      }
    }

    // Sync locations (Admin or Manager)
    if (locations && Array.isArray(locations)) {
      if (isAdmin) {
        await UserLocation.destroy({ where: { userId: user.id } });
        for (const locationId of locations) {
          await UserLocation.create({ userId: user.id, locationId });
        }
      } else if (isManager) {
        // Managers can only add/remove certifications for locations THEY manage
        // Fetch all current certifications
        const currentLocs = await UserLocation.findAll({ where: { userId: user.id } });
        
        // Remove certifications for locations manager manages that are not in the new list
        for (const cl of currentLocs) {
          if (managedLocIds.includes(cl.locationId) && !locations.includes(cl.locationId)) {
            await cl.destroy();
          }
        }
        
        // Add new certifications only for locations manager manages
        for (const locId of locations) {
          if (managedLocIds.includes(locId)) {
            await UserLocation.findOrCreate({ where: { userId: user.id, locationId: locId } });
          }
        }
      }
    }

    await logAudit(req.user.userId, 'User', user.id, 'USER_UPDATED', before, user.toJSON());

    const updatedUser = user.toJSON();
    delete updatedUser.passwordHash;
    res.json(updatedUser);
  } catch (err) {
    next(err);
  }
}

export async function getAvailability(req, res, next) {
  try {
    const userId = req.params.id;
    
    // Check permissions: self, admin, or manager of user's location
    if (req.user.role === 'manager' && req.user.userId !== userId) {
      const userLocations = await UserLocation.findAll({ where: { userId } });
      const managerLocations = await ManagerLocation.findAll({ where: { userId: req.user.userId } });
      
      const userLocIds = userLocations.map(ul => ul.locationId);
      const managerLocIds = managerLocations.map(ml => ml.locationId);
      
      const hasOverlap = userLocIds.some(id => managerLocIds.includes(id));
      if (!hasOverlap) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to view this user\'s availability' });
      }
    }

    const availabilities = await Availability.findAll({ where: { userId } });
    const exceptions = await AvailabilityException.findAll({ where: { userId } });

    res.json({ availabilities, exceptions });
  } catch (err) {
    next(err);
  }
}

export async function createAvailability(req, res, next) {
  try {
    const userId = req.params.id;
    const { dayOfWeek, startTime, endTime } = req.body;

    const availability = await Availability.create({
      userId,
      dayOfWeek,
      startTime,
      endTime
    });

    await logAudit(req.user.userId, 'Availability', availability.id, 'AVAILABILITY_CREATED', null, availability.toJSON());
    res.status(201).json(availability);
  } catch (err) {
    next(err);
  }
}

export async function deleteAvailability(req, res, next) {
  try {
    const availability = await Availability.findByPk(req.params.availId);
    if (!availability) return res.status(404).json({ error: 'NOT_FOUND', message: 'Availability not found' });
    
    const before = availability.toJSON();
    await availability.destroy();

    await logAudit(req.user.userId, 'Availability', availability.id, 'AVAILABILITY_DELETED', before, null);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function createAvailabilityException(req, res, next) {
  try {
    const userId = req.params.id;
    const { date, available, startTime, endTime } = req.body;

    const exception = await AvailabilityException.create({
      userId,
      date,
      available,
      startTime,
      endTime
    });

    await logAudit(req.user.userId, 'AvailabilityException', exception.id, 'AVAILABILITY_EXCEPTION_CREATED', null, exception.toJSON());
    res.status(201).json(exception);
  } catch (err) {
    next(err);
  }
}

export async function getSkills(req, res, next) {
  try {
    const skills = await UserSkill.findAll({
      where: { userId: req.params.id },
      include: [{ model: Skill, as: 'Skill' }]
    });
    res.json(skills);
  } catch (err) {
    next(err);
  }
}

export async function addSkill(req, res, next) {
  try {
    const { skillId } = req.body;
    const userId = req.params.id;

    const skill = await Skill.findByPk(skillId);
    const io = getIO();
    io.to(`user:${userId}`).emit('SKILL_ADDED', {
      event: 'SKILL_ADDED',
      title: 'New Skill Added',
      message: `You have been certified for a new skill: ${skill?.name || 'Unknown'}.`,
      data: { skillId, skillName: skill?.name }
    });

    res.status(201).json({ message: 'Skill added' });
  } catch (err) {
    next(err);
  }
}

export async function removeSkill(req, res, next) {
  try {
    await UserSkill.destroy({
      where: { userId: req.params.id, skillId: req.params.skillId }
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getLocations(req, res, next) {
  try {
    const locations = await UserLocation.findAll({
      where: { userId: req.params.id },
      include: [{ model: Location, as: 'Location' }]
    });
    res.json(locations);
  } catch (err) {
    next(err);
  }
}

export async function addLocation(req, res, next) {
  try {
    const { locationId } = req.body;
    const userId = req.params.id;

    await UserLocation.findOrCreate({
      where: { userId, locationId }
    });

    const location = await Location.findByPk(locationId);
    const io = getIO();
    io.to(`user:${userId}`).emit('LOCATION_CERTIFIED', {
      event: 'LOCATION_CERTIFIED',
      title: 'Location Certified',
      message: `You are now certified to work at ${location?.name || 'a new location'}.`,
      data: { locationId, locationName: location?.name }
    });

    await logAudit(req.user.userId, 'UserLocation', userId, 'CERTIFY_LOCATION', null, { locationId });
    res.status(201).json({ message: 'Location certified' });
  } catch (err) {
    next(err);
  }
}

export async function removeLocation(req, res, next) {
  try {
    const userId = req.params.id;
    const locationId = req.params.locationId;

    const cert = await UserLocation.findOne({ where: { userId, locationId } });
    if (!cert) return res.status(404).json({ error: 'NOT_FOUND', message: 'Certification not found' });

    await cert.destroy();

    // Any PENDING_ACCEPT or PENDING_MANAGER SwapRequests involving this user and this location's shifts must be cancelled
    const swaps = await SwapRequest.findAll({
      where: {
        status: ['PENDING_ACCEPT', 'PENDING_MANAGER']
      },
      include: [{
        model: Shift,
        as: 'shift',
        where: { locationId }
      }]
    });

    const io = getIO();

    for (const swap of swaps) {
      // Check if this user is involved in the swap
      if (swap.requesterId === userId || swap.targetId === userId) {
        const before = swap.toJSON();
        swap.status = 'CANCELLED';
        await swap.save();

        await logAudit(req.user.userId, 'SwapRequest', swap.id, 'SWAP_CANCELLED_DECERTIFIED', before, swap.toJSON());

        await notify(
          swap.requesterId,
          'SWAP_CANCELLED',
          `Swap request cancelled because a staff member was decertified from the location.`,
          { swapRequestId: swap.id },
          io
        );

        io.to(`user:${swap.requesterId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: 'CANCELLED' });

        if (swap.targetId) {
          await notify(
            swap.targetId,
            'SWAP_CANCELLED',
            `Swap request cancelled because a staff member was decertified from the location.`,
            { swapRequestId: swap.id },
            io
          );
          io.to(`user:${swap.targetId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: 'CANCELLED' });
        }
      }
    }

    await logAudit(req.user.userId, 'UserLocation', userId, 'DECERTIFY_LOCATION', { locationId }, null);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function assignManager(req, res, next) {
  try {
    const { managerId } = req.body;
    const staffId = req.params.id;
    const user = await reportingService.assignManager(staffId, managerId, req.user.userId);
    
    const manager = await User.findByPk(managerId);
    const io = getIO();
    io.to(`user:${staffId}`).emit('MANAGER_ASSIGNED', {
      event: 'MANAGER_ASSIGNED',
      title: 'New Manager Assigned',
      message: `You now report to ${manager?.name || 'a new manager'}.`,
      data: { managerId, managerName: manager?.name }
    });
    
    await notify(staffId, 'MANAGER_ASSIGNED', `You have been assigned to manager ${manager?.name || 'Unknown'}.`, { managerId }, io);

    res.json(user);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: 'BAD_REQUEST', message: err.message });
    }
    next(err);
  }
}

export async function getManager(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [{
        model: User,
        as: 'manager',
        attributes: ['id', 'name', 'email', 'role']
      }]
    });
    if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    res.json({ manager: user.manager });
  } catch (err) {
    next(err);
  }
}

export async function getReportingHistory(req, res, next) {
  try {
    const history = await reportingService.getReportingHistory(req.params.id);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

export async function getDirectReports(req, res, next) {
  try {
    // Permission check: admin or the manager themselves
    if (req.user.role !== 'admin' && req.user.userId !== req.params.id) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Access denied' });
    }

    // Confirm target user is manager (if self) or any (if admin)
    const targetUser = await User.findByPk(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    
    if (targetUser.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only managers have direct reports' });
    }

    const reports = await reportingService.getDirectReports(req.params.id);
    res.json(reports);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });

    user.isActive = false;
    await user.save();

    await logAudit(req.user.userId, 'User', user.id, 'USER_ARCHIVED', { isActive: true }, { isActive: false });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
