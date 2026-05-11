import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class ReportingHistory extends Model {}

  ReportingHistory.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    managerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    assignedById: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    supersededAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  }, {
    sequelize,
    modelName: 'ReportingHistory',
    tableName: 'ReportingHistory',
    timestamps: false,
  });

  return ReportingHistory;
};
