'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'reportsToId', {
      type: Sequelize.UUID,
      allowNull: true,
      defaultValue: null,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addIndex('Users', ['reportsToId']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Users', ['reportsToId']);
    await queryInterface.removeColumn('Users', 'reportsToId');
  }
};
