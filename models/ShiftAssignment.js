import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class ShiftAssignment extends Model {}

  ShiftAssignment.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    status: {
      type: DataTypes.ENUM('assigned', 'dropped', 'swapped', 'cancelled'),
      defaultValue: 'assigned',
    },
  }, {
    sequelize,
    modelName: 'ShiftAssignment',
  });

  return ShiftAssignment;
};
