import { Sequelize } from 'sequelize';
import databaseConfig from '../config/database.cjs';

import UserFactory from './User.js';
import LocationFactory from './Location.js';
import SkillFactory from './Skill.js';
import UserLocationFactory from './UserLocation.js';
import UserSkillFactory from './UserSkill.js';
import ManagerLocationFactory from './ManagerLocation.js';
import AvailabilityFactory from './Availability.js';
import AvailabilityExceptionFactory from './AvailabilityException.js';
import ShiftFactory from './Shift.js';
import ShiftAssignmentFactory from './ShiftAssignment.js';
import SwapRequestFactory from './SwapRequest.js';
import RefreshTokenFactory from './RefreshToken.js';
import NotificationFactory from './Notification.js';
import AuditLogFactory from './AuditLog.js';
import ReportingHistoryFactory from './ReportingHistory.js';
import LeaveRequestFactory from './LeaveRequest.js';

const env = process.env.NODE_ENV || 'development';
const config = databaseConfig[env];

const sequelize = new Sequelize(config.url, config);

const User = UserFactory(sequelize);
const Location = LocationFactory(sequelize);
const Skill = SkillFactory(sequelize);
const UserLocation = UserLocationFactory(sequelize);
const UserSkill = UserSkillFactory(sequelize);
const ManagerLocation = ManagerLocationFactory(sequelize);
const Availability = AvailabilityFactory(sequelize);
const AvailabilityException = AvailabilityExceptionFactory(sequelize);
const Shift = ShiftFactory(sequelize);
const ShiftAssignment = ShiftAssignmentFactory(sequelize);
const SwapRequest = SwapRequestFactory(sequelize);
const RefreshToken = RefreshTokenFactory(sequelize);
const Notification = NotificationFactory(sequelize);
const AuditLog = AuditLogFactory(sequelize);
const ReportingHistory = ReportingHistoryFactory(sequelize);
const LeaveRequest = LeaveRequestFactory(sequelize);

// --- Associations ---

// User reporting relationships
User.belongsTo(User, { foreignKey: 'reportsToId', as: 'manager' });
User.hasMany(User, { foreignKey: 'reportsToId', as: 'directReports' });

// ReportingHistory
ReportingHistory.belongsTo(User, { foreignKey: 'staffId', as: 'staff' });
ReportingHistory.belongsTo(User, { foreignKey: 'managerId', as: 'manager' });
ReportingHistory.belongsTo(User, { foreignKey: 'assignedById', as: 'assignedBy' });
User.hasMany(ReportingHistory, { foreignKey: 'staffId', as: 'reportingHistory' });

// LeaveRequest
LeaveRequest.belongsTo(User, { foreignKey: 'userId', as: 'user' });
LeaveRequest.belongsTo(User, { foreignKey: 'managerId', as: 'manager' });
LeaveRequest.hasMany(AvailabilityException, { foreignKey: 'leaveRequestId', as: 'blockedDays' });
AvailabilityException.belongsTo(LeaveRequest, { foreignKey: 'leaveRequestId', as: 'leaveRequest' });
User.hasMany(LeaveRequest, { foreignKey: 'userId', as: 'leaveRequests' });

// User <-> Location (Certification)
User.belongsToMany(Location, { through: UserLocation, foreignKey: 'userId', as: 'certifiedLocations' });
Location.belongsToMany(User, { through: UserLocation, foreignKey: 'locationId', as: 'certifiedStaff' });
UserLocation.belongsTo(User, { foreignKey: 'userId' });
UserLocation.belongsTo(Location, { foreignKey: 'locationId' });
User.hasMany(UserLocation, { foreignKey: 'userId' });
Location.hasMany(UserLocation, { foreignKey: 'locationId' });

// User <-> Skill
User.belongsToMany(Skill, { through: UserSkill, foreignKey: 'userId', as: 'skills' });
Skill.belongsToMany(User, { through: UserSkill, foreignKey: 'skillId', as: 'staff' });
UserSkill.belongsTo(User, { foreignKey: 'userId' });
UserSkill.belongsTo(Skill, { foreignKey: 'skillId' });
User.hasMany(UserSkill, { foreignKey: 'userId' });
Skill.hasMany(UserSkill, { foreignKey: 'skillId' });

// User <-> Location (Management)
User.belongsToMany(Location, { through: ManagerLocation, foreignKey: 'userId', as: 'managedLocations' });
Location.belongsToMany(User, { through: ManagerLocation, foreignKey: 'locationId', as: 'managers' });
ManagerLocation.belongsTo(User, { foreignKey: 'userId' });
ManagerLocation.belongsTo(Location, { foreignKey: 'locationId' });
User.hasMany(ManagerLocation, { foreignKey: 'userId' });
Location.hasMany(ManagerLocation, { foreignKey: 'locationId' });

// User -> Availability & Exceptions
User.hasMany(Availability, { foreignKey: 'userId', as: 'availabilities' });
Availability.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(AvailabilityException, { foreignKey: 'userId', as: 'availabilityExceptions' });
AvailabilityException.belongsTo(User, { foreignKey: 'userId' });

// Shift -> Location & Skill
Shift.belongsTo(Location, { foreignKey: 'locationId', as: 'location' });
Location.hasMany(Shift, { foreignKey: 'locationId', as: 'shifts' });

Shift.belongsTo(Skill, { foreignKey: 'skillId', as: 'skill' });
Skill.hasMany(Shift, { foreignKey: 'skillId', as: 'shifts' });

// ShiftAssignment -> Shift & User
ShiftAssignment.belongsTo(Shift, { foreignKey: 'shiftId', as: 'shift' });
Shift.hasMany(ShiftAssignment, { foreignKey: 'shiftId', as: 'assignments' });

ShiftAssignment.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ShiftAssignment, { foreignKey: 'userId', as: 'assignments' });

// SwapRequest
SwapRequest.belongsTo(Shift, { foreignKey: 'shiftId', as: 'shift' });
Shift.hasMany(SwapRequest, { foreignKey: 'shiftId', as: 'swapRequests' });

SwapRequest.belongsTo(User, { foreignKey: 'requesterId', as: 'requester' });
SwapRequest.belongsTo(User, { foreignKey: 'targetId', as: 'target' });
SwapRequest.belongsTo(User, { foreignKey: 'resolvedBy', as: 'resolver' });
User.hasMany(SwapRequest, { foreignKey: 'requesterId', as: 'requestedSwaps' });
User.hasMany(SwapRequest, { foreignKey: 'targetId', as: 'targetedSwaps' });

// RefreshToken
RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });

// Notification
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });

// AuditLog
AuditLog.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });
User.hasMany(AuditLog, { foreignKey: 'actorId', as: 'auditLogs' });

export {
  sequelize,
  User,
  Location,
  Skill,
  UserLocation,
  UserSkill,
  ManagerLocation,
  Availability,
  AvailabilityException,
  Shift,
  ShiftAssignment,
  SwapRequest,
  RefreshToken,
  Notification,
  AuditLog,
  ReportingHistory,
  LeaveRequest,
};
