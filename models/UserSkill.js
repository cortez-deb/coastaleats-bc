import { Model } from 'sequelize';

export default (sequelize) => {
  class UserSkill extends Model {}

  UserSkill.init({}, {
    sequelize,
    modelName: 'UserSkill',
  });

  return UserSkill;
};
