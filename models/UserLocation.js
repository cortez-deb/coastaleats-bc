import { Model } from 'sequelize';

export default (sequelize) => {
  class UserLocation extends Model {}

  UserLocation.init({}, {
    sequelize,
    modelName: 'UserLocation',
  });

  return UserLocation;
};
