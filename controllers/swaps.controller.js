import { Op } from 'sequelize';
import { SwapRequest, Shift, ShiftAssignment, User, Location } from '../models/index.js';
import { logAudit } from '../utils/auditLogger.js';
import { notify } from '../utils/notificationHelper.js';
import { getIO } from '../sockets/index.js';
import { swapQueue } from '../jobs/queues.js';

export async function createSwap(req, res, next) {
  try {
    const { shiftId, targetId, requesterNote } = req.body;
    const requesterId = req.user.userId;

    // Ensure requester is actually assigned to the shift
    const assignment = await ShiftAssignment.findOne({ where: { shiftId, userId: requesterId, status: 'assigned' } });
    if (!assignment) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'You are not assigned to this shift' });
    }

    // Limit to 3 pending requests
    const pendingCount = await SwapRequest.count({
      where: {
        requesterId,
        status: { [Op.in]: ['PENDING_ACCEPT', 'PENDING_MANAGER'] }
      }
    });

    if (pendingCount >= 3) {
      return res.status(400).json({ error: 'LIMIT_EXCEEDED', message: 'Maximum 3 pending requests allowed' });
    }

    // Prevent duplicate request for same shift
    const existing = await SwapRequest.findOne({
      where: {
        shiftId,
        requesterId,
        status: { [Op.in]: ['PENDING_ACCEPT', 'PENDING_MANAGER'] }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'DUPLICATE_REQUEST', message: 'You already have a pending request for this shift' });
    }

    const isDrop = !targetId;
    const status = isDrop ? 'PENDING_ACCEPT' : 'PENDING_ACCEPT'; // Always PENDING_ACCEPT initially

    const swap = await SwapRequest.create({
      shiftId,
      requesterId,
      targetId: targetId || null,
      status,
      requesterNote
    });

    const shift = await Shift.findByPk(shiftId);

    if (isDrop) {
      // Schedule expiration
      const expireTime = shift.startUtc.getTime() - 24 * 60 * 60 * 1000;
      const delay = expireTime - Date.now();
      
      if (delay > 0) {
        await swapQueue.add('cancelExpiredDrop', { swapRequestId: swap.id }, { delay });
      } else {
        // Already past 24 hours before shift, immediately cancel? The prompt says schedule it at startUtc - 24h.
        // If it's already past, maybe just reject creating it or immediately fire. We'll immediately fire.
        await swapQueue.add('cancelExpiredDrop', { swapRequestId: swap.id });
      }
    } else {
      // Notify target
      await notify(
        targetId,
        'SWAP_REQUESTED',
        `You have been requested to swap a shift.`,
        { swapRequestId: swap.id },
        getIO()
      );
    }

    await logAudit(requesterId, 'SwapRequest', swap.id, 'SWAP_CREATED', null, swap.toJSON());
    
    res.status(201).json(swap);
  } catch (err) {
    next(err);
  }
}

export async function getSwaps(req, res, next) {
  try {
    const { status, shiftId, userId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (shiftId) where.shiftId = shiftId;
    if (userId) {
      where[Op.or] = [{ requesterId: userId }, { targetId: userId }];
    }

    const swaps = await SwapRequest.findAll({ where });
    res.json(swaps);
  } catch (err) {
    next(err);
  }
}

export async function getSwap(req, res, next) {
  try {
    const swap = await SwapRequest.findByPk(req.params.id);
    if (!swap) return res.status(404).json({ error: 'NOT_FOUND', message: 'Swap request not found' });
    res.json(swap);
  } catch (err) {
    next(err);
  }
}

export async function acceptSwap(req, res, next) {
  try {
    const swap = await SwapRequest.findByPk(req.params.id);
    if (!swap) return res.status(404).json({ error: 'NOT_FOUND', message: 'Swap request not found' });

    if (swap.status !== 'PENDING_ACCEPT') {
      return res.status(400).json({ error: 'INVALID_TRANSITION', message: `Cannot accept swap from status ${swap.status}` });
    }

    // Target check: only target or anyone if it's an open drop (targetId is null)
    if (swap.targetId && swap.targetId !== req.user.userId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to accept this swap' });
    }

    // Qualification check
    const { UserSkill, UserLocation } = await import('../models/index.js');
    const shift = await Shift.findByPk(swap.shiftId);
    
    const [hasSkill, isCertified] = await Promise.all([
      UserSkill.findOne({ where: { userId: req.user.userId, skillId: shift.skillId } }),
      UserLocation.findOne({ where: { userId: req.user.userId, locationId: shift.locationId } })
    ]);

    if (!hasSkill) {
      return res.status(403).json({ error: 'NOT_QUALIFIED', message: 'You do not have the required skill for this shift' });
    }
    if (!isCertified) {
      return res.status(403).json({ error: 'NOT_QUALIFIED', message: 'You are not certified for this location' });
    }

    const before = swap.toJSON();
    swap.status = 'PENDING_MANAGER';
    if (!swap.targetId) {
      swap.targetId = req.user.userId;
    }
    await swap.save();

    const io = getIO();
    await logAudit(req.user.userId, 'SwapRequest', swap.id, 'SWAP_ACCEPTED', before, swap.toJSON());

    // Notify requester
    await notify(swap.requesterId, 'SWAP_ACCEPTED', 'Your swap request was accepted and is pending manager approval.', { swapRequestId: swap.id }, io);

    io.to(`user:${swap.requesterId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: swap.status });
    io.to(`user:${swap.targetId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: swap.status });

    res.json(swap);
  } catch (err) {
    next(err);
  }
}

export async function approveSwap(req, res, next) {
  try {
    const swap = await SwapRequest.findByPk(req.params.id);
    if (!swap) return res.status(404).json({ error: 'NOT_FOUND', message: 'Swap request not found' });

    const isDirectDropApproval = swap.status === 'PENDING_ACCEPT' && !swap.targetId;
    if (swap.status !== 'PENDING_MANAGER' && !isDirectDropApproval) {
      return res.status(400).json({ error: 'INVALID_TRANSITION', message: `Cannot approve swap from status ${swap.status}` });
    }

    const before = swap.toJSON();
    swap.status = 'APPROVED';
    swap.resolvedBy = req.user.userId;
    swap.resolvedAt = new Date();
    await swap.save();

    // Update Shift Assignments
    const requesterAssignment = await ShiftAssignment.findOne({ where: { shiftId: swap.shiftId, userId: swap.requesterId } });
    if (requesterAssignment) {
      requesterAssignment.status = 'swapped';
      await requesterAssignment.save();
    }

    if (swap.targetId) {
      await ShiftAssignment.create({
        shiftId: swap.shiftId,
        userId: swap.targetId,
        status: 'assigned'
      });
    }

    const io = getIO();
    await logAudit(req.user.userId, 'SwapRequest', swap.id, 'SWAP_APPROVED', before, swap.toJSON());

    await notify(swap.requesterId, 'SWAP_APPROVED', 'Your swap request was approved.', { swapRequestId: swap.id }, io);
    if (swap.targetId) {
      await notify(swap.targetId, 'SWAP_APPROVED', 'A swap request you accepted was approved.', { swapRequestId: swap.id }, io);
    }

    io.to(`user:${swap.requesterId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: swap.status });
    if (swap.targetId) {
      io.to(`user:${swap.targetId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: swap.status });
    }

    res.json(swap);
  } catch (err) {
    next(err);
  }
}

export async function rejectSwap(req, res, next) {
  try {
    const swap = await SwapRequest.findByPk(req.params.id);
    if (!swap) return res.status(404).json({ error: 'NOT_FOUND', message: 'Swap request not found' });

    if (swap.status !== 'PENDING_MANAGER') {
      return res.status(400).json({ error: 'INVALID_TRANSITION', message: `Cannot reject swap from status ${swap.status}` });
    }

    const before = swap.toJSON();
    swap.status = 'REJECTED';
    swap.resolvedBy = req.user.userId;
    swap.resolvedAt = new Date();
    await swap.save();

    const io = getIO();
    await logAudit(req.user.userId, 'SwapRequest', swap.id, 'SWAP_REJECTED', before, swap.toJSON());

    await notify(swap.requesterId, 'SWAP_REJECTED', 'Your swap request was rejected by a manager.', { swapRequestId: swap.id }, io);
    await notify(swap.targetId, 'SWAP_REJECTED', 'A swap request you accepted was rejected by a manager.', { swapRequestId: swap.id }, io);

    io.to(`user:${swap.requesterId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: swap.status });
    io.to(`user:${swap.targetId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: swap.status });

    res.json(swap);
  } catch (err) {
    next(err);
  }
}

export async function cancelSwap(req, res, next) {
  try {
    const swap = await SwapRequest.findByPk(req.params.id);
    if (!swap) return res.status(404).json({ error: 'NOT_FOUND', message: 'Swap request not found' });

    const isRequester = req.user.userId === swap.requesterId;
    const isManager = req.user.role === 'manager' || req.user.role === 'admin';

    if (isRequester && swap.status !== 'PENDING_ACCEPT') {
      return res.status(400).json({ error: 'INVALID_TRANSITION', message: 'Requester can only cancel PENDING_ACCEPT requests' });
    }

    if (!isRequester && !isManager) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to cancel this swap' });
    }

    const before = swap.toJSON();
    swap.status = 'CANCELLED';
    if (isManager && !isRequester) {
      swap.resolvedBy = req.user.userId;
      swap.resolvedAt = new Date();
    }
    await swap.save();

    const io = getIO();
    await logAudit(req.user.userId, 'SwapRequest', swap.id, 'SWAP_CANCELLED', before, swap.toJSON());

    io.to(`user:${swap.requesterId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: swap.status });
    if (swap.targetId) {
      io.to(`user:${swap.targetId}`).emit('swap:statusChanged', { swapRequestId: swap.id, newStatus: swap.status });
    }

    res.json(swap);
  } catch (err) {
    next(err);
  }
}
