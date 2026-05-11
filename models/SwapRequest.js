import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class SwapRequest extends Model {}

  SwapRequest.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING_ACCEPT', 'PENDING_MANAGER', 'APPROVED', 'REJECTED', 'CANCELLED'),
      allowNull: false,
    },
    requesterNote: {
      type: DataTypes.TEXT,
    },
    resolvedAt: {
      type: DataTypes.DATE,
    },
  }, {
    sequelize,
    modelName: 'SwapRequest',
  });

  return SwapRequest;
};
