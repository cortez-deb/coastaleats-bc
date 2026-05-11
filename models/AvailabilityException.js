import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class AvailabilityException extends Model {}

  AvailabilityException.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    available: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    endTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    leaveRequestId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'AvailabilityException',
  });

  return AvailabilityException;
};
