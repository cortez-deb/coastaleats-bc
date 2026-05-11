import { Model, DataTypes } from 'sequelize';
import { isPremiumShift } from '../utils/timezone.js';

export default (sequelize) => {
  class Shift extends Model {}

  Shift.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    startUtc: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endUtc: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    headcount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    isPremium: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    cutoffHours: {
      type: DataTypes.INTEGER,
      defaultValue: 48,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Shift',
    hooks: {
      beforeSave: async (shift, options) => {
        // Need to get the location to know the timezone
        const location = await sequelize.models.Location.findByPk(shift.locationId);
        if (location) {
          shift.isPremium = isPremiumShift(shift.startUtc.toISOString(), location.timezone);
        }
      }
    }
  });

  return Shift;
};
