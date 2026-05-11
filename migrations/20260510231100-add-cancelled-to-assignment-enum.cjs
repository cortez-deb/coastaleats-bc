'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // PostreSQL requires special handling to add values to an existing ENUM
    // This SQL command adds 'cancelled' to the ShiftAssignments status enum
    await queryInterface.sequelize.query('ALTER TYPE "enum_ShiftAssignments_status" ADD VALUE IF NOT EXISTS \'cancelled\';');
  },

  async down(queryInterface, Sequelize) {
    // ENUM values cannot be easily removed in PostgreSQL without recreating the type.
    // For a 'down' migration, we usually leave it as is or accept that it might remain.
    console.log('Down migration for adding enum value is a no-op due to PostgreSQL limitations.');
  }
};
