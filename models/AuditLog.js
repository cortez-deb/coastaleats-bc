import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class AuditLog extends Model {}

  AuditLog.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    before: {
      type: DataTypes.JSONB,
    },
    after: {
      type: DataTypes.JSONB,
    },
  }, {
    sequelize,
    modelName: 'AuditLog',
    updatedAt: false,
  });

  return AuditLog;
};
