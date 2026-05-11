import { Model } from 'sequelize';

export default (sequelize) => {
  class ManagerLocation extends Model {}

  ManagerLocation.init({}, {
    sequelize,
    modelName: 'ManagerLocation',
  });

  return ManagerLocation;
};
