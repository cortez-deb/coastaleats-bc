import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Skill extends Model {}

  Skill.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  }, {
    sequelize,
    modelName: 'Skill',
  });

  return Skill;
};
