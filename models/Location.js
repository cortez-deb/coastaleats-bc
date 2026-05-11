import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Location extends Model {}

  Location.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING,
    },
  }, {
    sequelize,
    modelName: 'Location',
  });

  return Location;
};
