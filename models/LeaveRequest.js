import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class LeaveRequest extends Model {}

  LeaveRequest.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
      defaultValue: 'PENDING',
    },
    managerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    managerNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    skippedDates: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
  }, {
    sequelize,
    modelName: 'LeaveRequest',
  });

  return LeaveRequest;
};
