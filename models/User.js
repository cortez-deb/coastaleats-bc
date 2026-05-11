import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class User extends Model {}

  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'manager', 'staff'),
      allowNull: false,
    },
    desiredHours: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    notifyInApp: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notifyEmail: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    reportsToId: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    hireDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'User',
  });

  return User;
};
