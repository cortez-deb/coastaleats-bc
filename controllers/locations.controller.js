import { Location, UserLocation, ManagerLocation, User } from '../models/index.js';

export async function getLocations(req, res, next) {
  try {
    const { Shift } = await import('../models/index.js');
    const locations = await Location.findAll({
      include: [{
        model: Shift,
        as: 'shifts',
        attributes: ['id']
      }]
    });

    const data = locations.map(l => ({
      ...l.toJSON(),
      shiftCount: l.shifts?.length || 0,
      shifts: undefined // don't send the full list
    }));

    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createLocation(req, res, next) {
  try {
    const { name, timezone, address } = req.body;
    const location = await Location.create({ name, timezone, address });
    res.status(201).json(location);
  } catch (err) {
    next(err);
  }
}

export async function getLocation(req, res, next) {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });
    res.json(location);
  } catch (err) {
    next(err);
  }
}

export async function updateLocation(req, res, next) {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });

    const { name, timezone, address } = req.body;
    if (name !== undefined) location.name = name;
    if (timezone !== undefined) location.timezone = timezone;
    if (address !== undefined) location.address = address;

    await location.save();
    res.json(location);
  } catch (err) {
    next(err);
  }
}

export async function getRoster(req, res, next) {
  try {
    const locationId = req.params.id;

    // Permissions: manager of that location or admin
    if (req.user.role === 'manager') {
      const ml = await ManagerLocation.findOne({ where: { userId: req.user.userId, locationId } });
      if (!ml) return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not manage this location' });
    }

    const roster = await UserLocation.findAll({
      where: { locationId },
      include: [{ 
        model: User, 
        as: 'User', // default association alias if not customized, but in models/index.js we used 'certifiedLocations' / 'certifiedStaff' for the belongsToMany. For the junction it belongsTo(User) usually creates 'User' alias unless configured differently. Let's use 'User'. 
        attributes: { exclude: ['passwordHash'] }
      }]
    });

    const staff = roster.map(r => r.User);
    res.json(staff);
  } catch (err) {
    next(err);
  }
}
export async function deleteLocation(req, res, next) {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ error: 'NOT_FOUND', message: 'Location not found' });

    await location.destroy();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function bulkUpdateCutoff(req, res, next) {
  try {
    const { locationId, cutoffHours } = req.body;
    const { Shift } = await import('../models/index.js');
    
    const where = {};
    if (locationId) where.locationId = locationId;

    await Shift.update({ cutoffHours }, { where });
    
    res.json({ success: true, message: `Updated cutoff hours for ${locationId ? 'selected location' : 'all locations'}` });
  } catch (err) {
    next(err);
  }
}
