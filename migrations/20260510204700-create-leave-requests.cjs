'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LeaveRequests', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      startDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      endDate: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
        defaultValue: 'PENDING'
      },
      managerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      managerNote: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      skippedDates: {
        type: Sequelize.JSON,
        defaultValue: []
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addColumn('AvailabilityExceptions', 'leaveRequestId', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'LeaveRequests', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('AvailabilityExceptions', 'leaveRequestId');
    await queryInterface.dropTable('LeaveRequests');
    // Note: Enum cleanup might be needed for some DBs like Postgres
  }
};
