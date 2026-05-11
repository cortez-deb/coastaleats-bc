import { User, ReportingHistory, AuditLog, sequelize } from '../models/index.js';
import { Op } from 'sequelize';

export const assignManager = async (staffId, managerId, actorId) => {
  const t = await sequelize.transaction();

  try {
    const staff = await User.findByPk(staffId);
    if (!staff) {
      throw { status: 404, message: "Staff member not found." };
    }
    if (staff.role !== 'staff') {
      throw { status: 400, message: "Reporting lines only apply to staff." };
    }

    if (managerId) {
      const manager = await User.findByPk(managerId);
      if (!manager) {
        throw { status: 404, message: "Manager not found." };
      }
      if (manager.role !== 'manager') {
        throw { status: 400, message: "The selected user is not a manager." };
      }
      if (managerId === staffId) {
        throw { status: 400, message: "A user cannot report to themselves." };
      }
    }

    if (staff.reportsToId === managerId) {
      await t.commit();
      return staff;
    }

    const previousReportsToId = staff.reportsToId;

    // Supersede current active record
    await ReportingHistory.update(
      { supersededAt: new Date() },
      {
        where: {
          staffId,
          supersededAt: null
        },
        transaction: t
      }
    );

    // Create new history record
    const history = await ReportingHistory.create({
      staffId,
      managerId,
      assignedById: actorId,
      assignedAt: new Date(),
      supersededAt: null
    }, { transaction: t });

    // Update User
    await staff.update({ reportsToId: managerId }, { transaction: t });

    // Audit Log
    await AuditLog.create({
      entityId: staffId,
      entityType: 'User',
      action: 'REPORTING_LINE_UPDATED',
      actorId: actorId,
      before: { reportsToId: previousReportsToId },
      after: { reportsToId: managerId },
      meta: { reportingHistoryId: history.id }
    }, { transaction: t });

    await t.commit();

    return await User.findByPk(staffId, {
      include: [{
        model: User,
        as: 'manager',
        attributes: ['id', 'name', 'email']
      }]
    });
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

export const getDirectReports = async (managerId) => {
  return await User.findAll({
    where: {
      reportsToId: managerId,
      role: 'staff'
    },
    include: [{
      model: User,
      as: 'manager',
      attributes: ['id', 'name', 'email']
    }]
  });
};

export const getReportingHistory = async (staffId) => {
  return await ReportingHistory.findAll({
    where: { staffId },
    order: [['assignedAt', 'DESC']],
    include: [
      {
        model: User,
        as: 'manager',
        attributes: ['id', 'name', 'email']
      },
      {
        model: User,
        as: 'assignedBy',
        attributes: ['id', 'name']
      }
    ]
  });
};

export const onStaffCreated = async (staffId, actorId) => {
  try {
    await ReportingHistory.create({
      staffId,
      managerId: null,
      assignedById: actorId,
      assignedAt: new Date(),
      supersededAt: null
    });
  } catch (err) {
    console.error('[reporting] failed to seed history on create:', err);
    // Do not rethrow
  }
};
