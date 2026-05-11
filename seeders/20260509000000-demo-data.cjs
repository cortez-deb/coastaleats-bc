'use strict';
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { DateTime } = require('luxon');

module.exports = {
  async up(queryInterface, Sequelize) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    const now = new Date();

    // 1. Users
    const adminId = uuidv4();
    const managerId = uuidv4();
    const staff1Id = uuidv4();
    const staff2Id = uuidv4();
    const staff3Id = uuidv4();
    const staff4Id = uuidv4();

    await queryInterface.bulkInsert('Users', [
      { id: adminId, name: 'System Admin', email: 'admin@coastaleats.com', passwordHash: hash, role: 'admin', createdAt: now, updatedAt: now },
      { id: managerId, name: 'Downtown Manager', email: 'manager@coastaleats.com', passwordHash: hash, role: 'manager', createdAt: now, updatedAt: now },
      { id: staff1Id, name: 'John Doe (Full-time)', email: 'john@coastaleats.com', passwordHash: hash, role: 'staff', desiredHours: 40, createdAt: now, updatedAt: now },
      { id: staff2Id, name: 'Jane Smith (Part-time)', email: 'jane@coastaleats.com', passwordHash: hash, role: 'staff', desiredHours: 20, createdAt: now, updatedAt: now },
      { id: staff3Id, name: 'Alice Jones (Flexible)', email: 'alice@coastaleats.com', passwordHash: hash, role: 'staff', desiredHours: 35, createdAt: now, updatedAt: now },
      { id: staff4Id, name: 'Bob Wilson (Kitchen)', email: 'bob@coastaleats.com', passwordHash: hash, role: 'staff', desiredHours: 25, createdAt: now, updatedAt: now }
    ]);

    // 2. Locations
    const loc1Id = uuidv4(); // Downtown
    const loc2Id = uuidv4(); // Beachside

    await queryInterface.bulkInsert('Locations', [
      { id: loc1Id, name: 'Downtown (EST)', timezone: 'America/New_York', createdAt: now, updatedAt: now },
      { id: loc2Id, name: 'Beachside (EST)', timezone: 'America/New_York', createdAt: now, updatedAt: now }
    ]);

    // 3. Skills
    const skillBartender = uuidv4();
    const skillServer = uuidv4();
    const skillKitchen = uuidv4();

    await queryInterface.bulkInsert('Skills', [
      { id: skillBartender, name: 'Bartender', createdAt: now, updatedAt: now },
      { id: skillServer, name: 'Server', createdAt: now, updatedAt: now },
      { id: skillKitchen, name: 'Kitchen Staff', createdAt: now, updatedAt: now }
    ]);

    // 4. Associations
    await queryInterface.bulkInsert('ManagerLocations', [
      { userId: managerId, locationId: loc1Id, createdAt: now, updatedAt: now }
    ]);

    await queryInterface.bulkInsert('UserLocations', [
      { userId: staff1Id, locationId: loc1Id, createdAt: now, updatedAt: now },
      { userId: staff2Id, locationId: loc1Id, createdAt: now, updatedAt: now },
      { userId: staff3Id, locationId: loc1Id, createdAt: now, updatedAt: now },
      { userId: staff3Id, locationId: loc2Id, createdAt: now, updatedAt: now },
      { userId: staff4Id, locationId: loc1Id, createdAt: now, updatedAt: now }
    ]);

    await queryInterface.bulkInsert('UserSkills', [
      { userId: staff1Id, skillId: skillBartender, createdAt: now, updatedAt: now },
      { userId: staff1Id, skillId: skillServer, createdAt: now, updatedAt: now },
      { userId: staff2Id, skillId: skillServer, createdAt: now, updatedAt: now },
      { userId: staff3Id, skillId: skillBartender, createdAt: now, updatedAt: now },
      { userId: staff4Id, skillId: skillKitchen, createdAt: now, updatedAt: now }
    ]);

    // 5. Availability (Recurring)
    const availabilities = [];
    // Staff 1: Mon-Fri 08:00-16:00
    for (let i = 1; i <= 5; i++) {
      availabilities.push({ id: uuidv4(), userId: staff1Id, dayOfWeek: i, startTime: '08:00', endTime: '16:00', createdAt: now, updatedAt: now });
    }
    // Staff 2: Fri-Sat 16:00-00:00
    availabilities.push({ id: uuidv4(), userId: staff2Id, dayOfWeek: 5, startTime: '16:00', endTime: '23:59', createdAt: now, updatedAt: now });
    availabilities.push({ id: uuidv4(), userId: staff2Id, dayOfWeek: 6, startTime: '16:00', endTime: '23:59', createdAt: now, updatedAt: now });
    // Staff 3: Every day 12:00-22:00
    for (let i = 0; i <= 6; i++) {
      availabilities.push({ id: uuidv4(), userId: staff3Id, dayOfWeek: i, startTime: '12:00', endTime: '22:00', createdAt: now, updatedAt: now });
    }
    await queryInterface.bulkInsert('Availabilities', availabilities);

    // 6. Leave Requests & Exceptions
    const leave1Id = uuidv4();
    await queryInterface.bulkInsert('LeaveRequests', [
      {
        id: leave1Id,
        userId: staff4Id,
        startDate: '2026-05-13',
        endDate: '2026-05-13',
        reason: 'Dentist Appointment',
        status: 'APPROVED',
        managerId: managerId,
        createdAt: now,
        updatedAt: now
      }
    ]);

    await queryInterface.bulkInsert('AvailabilityExceptions', [
      {
        id: uuidv4(),
        userId: staff4Id,
        date: '2026-05-13',
        available: false,
        leaveRequestId: leave1Id,
        createdAt: now,
        updatedAt: now
      }
    ]);

    // 7. Shifts
    const baseDate = DateTime.fromISO('2026-05-11T00:00:00', { zone: 'America/New_York' });
    const shiftData = [];

    // Week 1 Shifts
    for (let day = 0; day < 7; day++) {
      const dayDt = baseDate.plus({ days: day });
      
      // Lunch Shift
      shiftData.push({
        id: uuidv4(),
        locationId: loc1Id,
        skillId: skillServer,
        startUtc: dayDt.plus({ hours: 10 }).toJSDate(),
        endUtc: dayDt.plus({ hours: 16 }).toJSDate(),
        headcount: 2,
        isPublished: true,
        createdAt: now,
        updatedAt: now
      });

      // Dinner Shift
      shiftData.push({
        id: uuidv4(),
        locationId: loc1Id,
        skillId: skillBartender,
        startUtc: dayDt.plus({ hours: 17 }).toJSDate(),
        endUtc: dayDt.plus({ hours: 23 }).toJSDate(),
        headcount: 1,
        isPublished: true,
        isPremium: (day === 4 || day === 5), // Fri/Sat premium
        createdAt: now,
        updatedAt: now
      });

      // Kitchen Shift
      shiftData.push({
        id: uuidv4(),
        locationId: loc1Id,
        skillId: skillKitchen,
        startUtc: dayDt.plus({ hours: 10 }).toJSDate(),
        endUtc: dayDt.plus({ hours: 22 }).toJSDate(), // Long 12h shift
        headcount: 1,
        isPublished: true,
        createdAt: now,
        updatedAt: now
      });
    }

    await queryInterface.bulkInsert('Shifts', shiftData);

    // 8. Assignments
    const assignments = [
      // Staff 1 (John) - Mon to Thu Lunch
      { id: uuidv4(), shiftId: shiftData[0].id, userId: staff1Id, status: 'assigned', createdAt: now, updatedAt: now },
      { id: uuidv4(), shiftId: shiftData[3].id, userId: staff1Id, status: 'assigned', createdAt: now, updatedAt: now },
      { id: uuidv4(), shiftId: shiftData[6].id, userId: staff1Id, status: 'assigned', createdAt: now, updatedAt: now },
      { id: uuidv4(), shiftId: shiftData[9].id, userId: staff1Id, status: 'assigned', createdAt: now, updatedAt: now },
      
      // Staff 2 (Jane) - Fri/Sat Dinner (Premium)
      { id: uuidv4(), shiftId: shiftData[13].id, userId: staff2Id, status: 'assigned', createdAt: now, updatedAt: now },
      { id: uuidv4(), shiftId: shiftData[16].id, userId: staff2Id, status: 'assigned', createdAt: now, updatedAt: now },
      
      // Staff 3 (Alice) - Consecutive Days Demo (assigned Mon-Sat)
      { id: uuidv4(), shiftId: shiftData[1].id, userId: staff3Id, status: 'assigned', createdAt: now, updatedAt: now },
      { id: uuidv4(), shiftId: shiftData[4].id, userId: staff3Id, status: 'assigned', createdAt: now, updatedAt: now },
      { id: uuidv4(), shiftId: shiftData[7].id, userId: staff3Id, status: 'assigned', createdAt: now, updatedAt: now },
      { id: uuidv4(), shiftId: shiftData[10].id, userId: staff3Id, status: 'assigned', createdAt: now, updatedAt: now },
      { id: uuidv4(), shiftId: shiftData[13].id, userId: staff3Id, status: 'assigned', createdAt: now, updatedAt: now }, 
      { id: uuidv4(), shiftId: shiftData[16].id, userId: staff3Id, status: 'assigned', createdAt: now, updatedAt: now },
      
      // Staff 4 (Bob) - Mon Kitchen
      { id: uuidv4(), shiftId: shiftData[2].id, userId: staff4Id, status: 'assigned', createdAt: now, updatedAt: now }
    ];

    await queryInterface.bulkInsert('ShiftAssignments', assignments);

    // 9. Swap Requests
    await queryInterface.bulkInsert('SwapRequests', [
      {
        id: uuidv4(),
        shiftId: shiftData[13].id,
        requesterId: staff2Id,
        status: 'PENDING_MANAGER',
        requesterNote: 'Need to visit family.',
        createdAt: now,
        updatedAt: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('SwapRequests', null, {});
    await queryInterface.bulkDelete('ShiftAssignments', null, {});
    await queryInterface.bulkDelete('Shifts', null, {});
    await queryInterface.bulkDelete('AvailabilityExceptions', null, {});
    await queryInterface.bulkDelete('LeaveRequests', null, {});
    await queryInterface.bulkDelete('Availabilities', null, {});
    await queryInterface.bulkDelete('UserSkills', null, {});
    await queryInterface.bulkDelete('UserLocations', null, {});
    await queryInterface.bulkDelete('ManagerLocations', null, {});
    await queryInterface.bulkDelete('Skills', null, {});
    await queryInterface.bulkDelete('Locations', null, {});
    await queryInterface.bulkDelete('Users', null, {});
  }
};
