'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.ENUM('admin', 'manager', 'staff'), allowNull: false },
      desiredHours: { type: Sequelize.INTEGER, allowNull: true },
      notifyInApp: { type: Sequelize.BOOLEAN, defaultValue: true },
      notifyEmail: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('Locations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      timezone: { type: Sequelize.STRING, allowNull: false },
      address: { type: Sequelize.STRING },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('Skills', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('UserLocations', {
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
      locationId: { type: Sequelize.UUID, references: { model: 'Locations', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('UserSkills', {
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
      skillId: { type: Sequelize.UUID, references: { model: 'Skills', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('ManagerLocations', {
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
      locationId: { type: Sequelize.UUID, references: { model: 'Locations', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('Availabilities', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      dayOfWeek: { type: Sequelize.INTEGER, allowNull: false },
      startTime: { type: Sequelize.STRING, allowNull: false },
      endTime: { type: Sequelize.STRING, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('AvailabilityExceptions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      available: { type: Sequelize.BOOLEAN, allowNull: false },
      startTime: { type: Sequelize.STRING, allowNull: true },
      endTime: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('Shifts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      locationId: { type: Sequelize.UUID, references: { model: 'Locations', key: 'id' }, onDelete: 'CASCADE' },
      skillId: { type: Sequelize.UUID, references: { model: 'Skills', key: 'id' }, onDelete: 'CASCADE' },
      startUtc: { type: Sequelize.DATE, allowNull: false },
      endUtc: { type: Sequelize.DATE, allowNull: false },
      headcount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      isPremium: { type: Sequelize.BOOLEAN, defaultValue: false },
      isPublished: { type: Sequelize.BOOLEAN, defaultValue: false },
      cutoffHours: { type: Sequelize.INTEGER, defaultValue: 48 },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('ShiftAssignments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      shiftId: { type: Sequelize.UUID, references: { model: 'Shifts', key: 'id' }, onDelete: 'CASCADE' },
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      status: { type: Sequelize.ENUM('assigned', 'dropped', 'swapped'), defaultValue: 'assigned' },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('SwapRequests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      shiftId: { type: Sequelize.UUID, references: { model: 'Shifts', key: 'id' }, onDelete: 'CASCADE' },
      requesterId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      targetId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', allowNull: true },
      status: { type: Sequelize.ENUM('PENDING_ACCEPT', 'PENDING_MANAGER', 'APPROVED', 'REJECTED', 'CANCELLED'), allowNull: false },
      requesterNote: { type: Sequelize.TEXT },
      resolvedBy: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', allowNull: true },
      resolvedAt: { type: Sequelize.DATE },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('RefreshTokens', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      token: { type: Sequelize.STRING, allowNull: false, unique: true },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      revoked: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('Notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      type: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: false },
      read: { type: Sequelize.BOOLEAN, defaultValue: false },
      metadata: { type: Sequelize.JSONB },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('AuditLogs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      actorId: { type: Sequelize.UUID, references: { model: 'Users', key: 'id' }, onDelete: 'SET NULL', allowNull: true },
      entityType: { type: Sequelize.STRING, allowNull: false },
      entityId: { type: Sequelize.UUID, allowNull: false },
      action: { type: Sequelize.STRING, allowNull: false },
      before: { type: Sequelize.JSONB },
      after: { type: Sequelize.JSONB },
      createdAt: { type: Sequelize.DATE, allowNull: false }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('AuditLogs');
    await queryInterface.dropTable('Notifications');
    await queryInterface.dropTable('RefreshTokens');
    await queryInterface.dropTable('SwapRequests');
    await queryInterface.dropTable('ShiftAssignments');
    await queryInterface.dropTable('Shifts');
    await queryInterface.dropTable('AvailabilityExceptions');
    await queryInterface.dropTable('Availabilities');
    await queryInterface.dropTable('ManagerLocations');
    await queryInterface.dropTable('UserSkills');
    await queryInterface.dropTable('UserLocations');
    await queryInterface.dropTable('Skills');
    await queryInterface.dropTable('Locations');
    await queryInterface.dropTable('Users');
    
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Users_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ShiftAssignments_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SwapRequests_status";');
  }
};
