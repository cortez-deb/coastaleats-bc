import { LeaveRequest, User, Availability, AvailabilityException, Shift, ShiftAssignment, AuditLog, sequelize, Location, Notification, Skill, ManagerLocation } from '../models/index.js';
import { Op } from 'sequelize';
import { DateTime } from 'luxon';

export const createLeaveRequest = async (userId, startDateStr, endDateStr, reason, io) => {
  const startDate = DateTime.fromISO(startDateStr);
  const endDate = DateTime.fromISO(endDateStr);

  if (endDate < startDate) {
    throw { status: 422, message: "End date must be after start date." };
  }

  const dates = [];
  let curr = startDate;
  while (curr <= endDate) {
    dates.push(curr);
    curr = curr.plus({ days: 1 });
  }
  const skippedDates = [];
  const processableDates = [];

  const now = DateTime.now();

  for (const date of dates) {
    const dateStr = date.toISODate();
    
    // Check for shifts past cutoff
    const assignments = await ShiftAssignment.findAll({
      where: { userId, status: 'assigned' },
      include: [{
        model: Shift,
        as: 'shift',
        where: {
          startUtc: {
            [Op.gte]: date.startOf('day').toJSDate(),
            [Op.lt]: date.plus({ days: 1 }).startOf('day').toJSDate()
          },
          cutoffHours: { [Op.ne]: null }
        }
      }]
    });

    const pastCutoff = assignments.some(a => {
      const cutoffDate = DateTime.fromJSDate(a.shift.startUtc).minus({ hours: a.shift.cutoffHours || 0 });
      return cutoffDate < now;
    });

    if (pastCutoff) {
      skippedDates.push(dateStr);
    } else {
      // Check for existing approved leave or pending
      const existing = await LeaveRequest.findOne({
        where: {
          userId,
          status: { [Op.in]: ['PENDING', 'APPROVED'] },
          startDate: { [Op.lte]: dateStr },
          endDate: { [Op.gte]: dateStr }
        }
      });

      if (!existing) {
        processableDates.push(dateStr);
      }
    }
  }

  if (processableDates.length === 0 && skippedDates.length > 0) {
    throw {
      status: 422,
      error: "all_dates_blocked",
      message: "All dates in this range have shifts past the edit cutoff and cannot be included in a leave request.",
      skippedDates
    };
  }

  const leaveRequest = await LeaveRequest.create({
    userId,
    startDate: startDateStr,
    endDate: endDateStr,
    reason,
    skippedDates,
    status: 'PENDING'
  });

  // Audit Log
  await AuditLog.create({
    entityId: leaveRequest.id,
    entityType: 'LeaveRequest',
    action: 'LEAVE_CREATED',
    actorId: userId,
    after: leaveRequest.toJSON()
  });

  // Notify Managers
  const user = await User.findByPk(userId, {
    include: [{ model: Location, as: 'certifiedLocations' }]
  });

  // Identify managers to notify
  const managerIds = new Set();
  if (user.reportsToId) managerIds.add(user.reportsToId);

  const locationIds = user.certifiedLocations.map(l => l.id);
  
  // Find managers of user's locations
  const locManagers = await User.findAll({
    where: { role: { [Op.in]: ['manager', 'admin'] } },
    include: [{
      model: Location,
      as: 'managedLocations',
      where: { id: { [Op.in]: locationIds } }
    }]
  });

  locManagers.forEach(m => managerIds.add(m.id));

  for (const mId of managerIds) {
    await Notification.create({
      userId: mId,
      type: 'LEAVE_REQUESTED',
      message: `${user.name} requested leave from ${startDateStr} to ${endDateStr}.`,
      metadata: { leaveRequestId: leaveRequest.id, staffName: user.name, startDate: startDateStr, endDate: endDateStr, reason }
    });
    
    // Direct socket notification if direct manager
    if (io && user.reportsToId === mId) {
      io.to(`user:${mId}`).emit('LEAVE_REQUESTED', {
        event: 'LEAVE_REQUESTED',
        title: 'New Leave Request',
        message: `${user.name} requested leave from ${startDateStr} to ${endDateStr}.`,
        data: {
          leaveRequestId: leaveRequest.id, 
          userId,
          staffName: user.name,
          startDate: startDateStr,
          endDate: endDateStr,
          reason
        }
      });
    }
  }

  // Real-time events
  if (io) {
    locationIds.forEach(locId => {
      io.to(`location:${locId}`).emit('LEAVE_REQUESTED', { 
        event: 'LEAVE_REQUESTED',
        title: 'New Leave Request',
        message: `${user.name} requested leave from ${startDateStr} to ${endDateStr}.`,
        data: {
          leaveRequestId: leaveRequest.id, 
          userId,
          staffName: user.name,
          startDate: startDateStr,
          endDate: endDateStr,
          reason
        }
      });
    });
  }

  return { ...leaveRequest.toJSON(), skippedDates };
};

export const approveLeaveRequest = async (leaveRequestId, managerId, managerNote, io) => {
  const t = await sequelize.transaction();

  try {
    const leaveRequest = await LeaveRequest.findByPk(leaveRequestId, { transaction: t });
    if (!leaveRequest) throw { status: 404, message: "Leave request not found." };
    if (leaveRequest.status !== 'PENDING') throw { status: 409, message: "This request has already been actioned." };

    const staffId = leaveRequest.userId;
    const staff = await User.findByPk(staffId, { transaction: t });

    // Expand approved dates (excluding skipped ones)
    const startDate = DateTime.fromISO(leaveRequest.startDate);
    const endDate = DateTime.fromISO(leaveRequest.endDate);
    const dates = [];
    let curr = startDate;
    while (curr <= endDate) {
      dates.push(curr);
      curr = curr.plus({ days: 1 });
    }
    
    const skippedSet = new Set(leaveRequest.skippedDates);
    const approvedDates = dates.filter(d => !skippedSet.has(d.toISODate()));

    // Create AvailabilityExceptions
    for (const date of approvedDates) {
      await AvailabilityException.create({
        userId: staffId,
        date: date.toISODate(),
        available: false,
        leaveRequestId: leaveRequest.id
      }, { transaction: t });
    }

    // Find and cancel active shift assignments
    const assignments = await ShiftAssignment.findAll({
      where: { 
        userId: staffId, 
        status: 'assigned' 
      },
      include: [{
        model: Shift,
        as: 'shift',
        include: [{ model: Skill, as: 'skill' }],
        where: {
          startUtc: {
            [Op.gte]: startDate.startOf('day').toJSDate(),
            [Op.lt]: endDate.plus({ days: 1 }).startOf('day').toJSDate()
          }
        }
      }],
      transaction: t
    });

    const affectedLocationIds = new Set();
    const cancelledAssignmentIds = [];

    for (const assignment of assignments) {
      const shiftDate = DateTime.fromJSDate(assignment.shift.startUtc).toISODate();
      if (approvedDates.some(d => d.toISODate() === shiftDate)) {
        assignment.status = 'cancelled';
        await assignment.save({ transaction: t });
        
        cancelledAssignmentIds.push(assignment.id);
        affectedLocationIds.add(assignment.shift.locationId);

        await AuditLog.create({
          entityId: assignment.id,
          entityType: 'ShiftAssignment',
          action: 'LEAVE_APPROVAL_UNASSIGN',
          actorId: managerId,
          before: { status: 'assigned' },
          after: { status: 'cancelled' },
          meta: { leaveRequestId }
        }, { transaction: t });
      }
    }

    const affectedShifts = assignments
      .filter(a => cancelledAssignmentIds.includes(a.id))
      .map(a => {
        const dt = DateTime.fromJSDate(a.shift.startUtc);
        const endDt = DateTime.fromJSDate(a.shift.endUtc);
        return {
          id: a.shift.id,
          date: dt.toISODate(),
          startTime: dt.toFormat('HH:mm'),
          endTime: endDt.toFormat('HH:mm'),
          locationId: a.shift.locationId,
          role: a.shift.skill?.name || 'Staff'
        };
      });

    leaveRequest.status = 'APPROVED';
    leaveRequest.managerId = managerId;
    leaveRequest.managerNote = managerNote;
    await leaveRequest.save({ transaction: t });

    await AuditLog.create({
      entityId: leaveRequest.id,
      entityType: 'LeaveRequest',
      action: 'LEAVE_APPROVED',
      actorId: managerId,
      before: { status: 'PENDING' },
      after: { status: 'APPROVED' },
      meta: { cancelledAssignmentIds, affectedShifts, managerNote }
    }, { transaction: t });

    // Persist notification for staff
    await Notification.create({
      userId: staffId,
      type: 'LEAVE_APPROVED',
      message: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} has been approved.`,
      metadata: { leaveRequestId, managerNote }
    }, { transaction: t });

    // Persist notifications for managers of affected locations
    const managers = await User.findAll({
      where: { role: { [Op.in]: ['manager', 'admin'] } },
      include: [{
        model: Location,
        as: 'managedLocations',
        where: { id: { [Op.in]: Array.from(affectedLocationIds) } }
      }],
      transaction: t
    });

    for (const manager of managers) {
      await Notification.create({
        userId: manager.id,
        type: 'LEAVE_SHIFT_UNASSIGNED',
        message: `${staff.name}'s leave was approved, unassigning them from ${affectedShifts.length} shifts.`,
        metadata: { leaveRequestId, staffName: staff.name, affectedShifts }
      }, { transaction: t });
    }

    await t.commit();

      // Notifications & Socket events
      if (io) {
        io.to(`user:${staffId}`).emit('LEAVE_APPROVED', { 
          event: 'LEAVE_APPROVED',
          title: 'Leave Approved',
          message: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} has been approved.`,
          data: { leaveRequestId, startDate: leaveRequest.startDate, endDate: leaveRequest.endDate }
        });
        
        for (const locId of affectedLocationIds) {
          const locationShifts = affectedShifts.filter(s => s.locationId === locId);

          // Emit real-time event
          io.to(`location:${locId}`).emit('LEAVE_SHIFT_UNASSIGNED', {
            event: 'LEAVE_SHIFT_UNASSIGNED',
            title: 'Staff Unassigned',
            message: `${staff.name}'s leave was approved, unassigning them from shifts.`,
            data: {
              leaveRequestId,
              staffName: staff.name,
              affectedShifts: locationShifts
            }
          });

          // Persistent notification for managers of this location
          const locationManagers = await ManagerLocation.findAll({ where: { locationId: locId } });
          const adminUsers = await User.findAll({ where: { role: 'admin' } });
          const managerIds = [...new Set([
            ...locationManagers.map(m => m.userId),
            ...adminUsers.map(u => u.id)
          ])];

          for (const managerId of managerIds) {
            await Notification.create({
              userId: managerId,
              type: 'LEAVE_SHIFT_UNASSIGNED',
              message: `${staff.name}'s leave was approved, unassigning them from shifts.`,
              metadata: {
                leaveRequestId,
                staffName: staff.name,
                affectedShifts: locationShifts
              }
            });
          }
        }
      }

    return leaveRequest;
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

export const rejectLeaveRequest = async (leaveRequestId, managerId, managerNote, io) => {
  const leaveRequest = await LeaveRequest.findByPk(leaveRequestId);
  if (!leaveRequest) throw { status: 404, message: "Leave request not found." };
  if (leaveRequest.status !== 'PENDING') throw { status: 409, message: "This request has already been actioned." };

  leaveRequest.status = 'REJECTED';
  leaveRequest.managerId = managerId;
  leaveRequest.managerNote = managerNote;
  await leaveRequest.save();

  await AuditLog.create({
    entityId: leaveRequest.id,
    entityType: 'LeaveRequest',
    action: 'LEAVE_REJECTED',
    actorId: managerId,
    before: { status: 'PENDING' },
    after: { status: 'REJECTED' },
    meta: { managerNote }
  });

  if (io) {
    io.to(`user:${leaveRequest.userId}`).emit('LEAVE_REJECTED', { 
      event: 'LEAVE_REJECTED',
      title: 'Leave Rejected',
      message: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} was rejected.`,
      data: { leaveRequestId, managerNote }
    });
  }

  await Notification.create({
    userId: leaveRequest.userId,
    type: 'LEAVE_REJECTED',
    message: `Your leave request from ${leaveRequest.startDate} to ${leaveRequest.endDate} was rejected.`,
    metadata: { leaveRequestId, managerNote }
  });

  return leaveRequest;
};

export const cancelLeaveRequest = async (leaveRequestId, userId, io) => {
  const leaveRequest = await LeaveRequest.findByPk(leaveRequestId);
  if (!leaveRequest) throw { status: 404, message: "Leave request not found." };
  if (leaveRequest.userId !== userId) throw { status: 403, message: "You can only cancel your own requests." };
  if (leaveRequest.status !== 'PENDING') throw { status: 409, message: "Only pending requests can be cancelled." };

  leaveRequest.status = 'CANCELLED';
  await leaveRequest.save();

  await AuditLog.create({
    entityId: leaveRequest.id,
    entityType: 'LeaveRequest',
    action: 'LEAVE_CANCELLED',
    actorId: userId,
    before: { status: 'PENDING' },
    after: { status: 'CANCELLED' }
  });

  if (io) {
    const user = await User.findByPk(userId, {
      include: [{ model: Location, as: 'certifiedLocations' }]
    });
    const locationIds = user.certifiedLocations.map(l => l.id);
    const managers = await User.findAll({
      where: { role: { [Op.in]: ['manager', 'admin'] } },
      include: [{
        model: Location,
        as: 'managedLocations',
        where: { id: { [Op.in]: locationIds } }
      }]
    });

    for (const manager of managers) {
      await Notification.create({
        userId: manager.id,
        type: 'LEAVE_CANCELLED',
        message: `${user.name} cancelled their leave request.`,
        metadata: { leaveRequestId, staffName: user.name }
      });
    }

    locationIds.forEach(locId => {
      io.to(`location:${locId}`).emit('LEAVE_CANCELLED', { 
        event: 'LEAVE_CANCELLED',
        title: 'Leave Cancelled',
        message: `${user.name} cancelled their leave request.`,
        data: { leaveRequestId, userId, staffName: user.name }
      });
    });
  }

  return leaveRequest;
};

export const seedDefaultAvailability = async (userId) => {
  const days = [1, 2, 3, 4, 5, 6]; // Mon-Sat
  for (const day of days) {
    await Availability.create({
      userId,
      dayOfWeek: day,
      startTime: '00:00',
      endTime: '23:59'
    });
  }
};
