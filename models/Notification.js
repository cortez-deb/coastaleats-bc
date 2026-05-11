import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Notification extends Model {}

  Notification.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    metadata: {
      type: DataTypes.JSONB,
    },
  }, {
    sequelize,
    modelName: 'Notification',
  });

  return Notification;
};
