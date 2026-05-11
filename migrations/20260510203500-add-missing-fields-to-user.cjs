'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Users');
    
    if (!tableInfo.isActive) {
      await queryInterface.addColumn('Users', 'isActive', {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      });
    }
    
    if (!tableInfo.phone) {
      await queryInterface.addColumn('Users', 'phone', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    
    if (!tableInfo.hireDate) {
      await queryInterface.addColumn('Users', 'hireDate', {
        type: Sequelize.DATEONLY,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'isActive');
    await queryInterface.removeColumn('Users', 'phone');
    await queryInterface.removeColumn('Users', 'hireDate');
  }
};
