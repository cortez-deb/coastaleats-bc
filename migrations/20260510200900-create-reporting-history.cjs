'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ReportingHistory', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      staffId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
      },
      managerId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL'
      },
      assignedById: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'RESTRICT'
      },
      assignedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      supersededAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      }
    });

    await queryInterface.addIndex('ReportingHistory', ['staffId', 'supersededAt']);
    await queryInterface.addIndex('ReportingHistory', ['managerId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ReportingHistory');
  }
};
