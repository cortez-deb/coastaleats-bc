import { Worker } from 'bullmq';
import redisClient from '../config/redis.js';
import { SwapRequest, ShiftAssignment } from '../models/index.js';
import { notify } from '../utils/notificationHelper.js';
import { logAudit } from '../utils/auditLogger.js';

export function startWorkers(io) {
  const swapWorker = new Worker('swapQueue', async job => {
    if (job.name === 'cancelExpiredDrop') {
      const { swapRequestId } = job.data;
      const swap = await SwapRequest.findByPk(swapRequestId);
      
      if (swap && swap.status === 'PENDING_ACCEPT') {
        const before = swap.toJSON();
        swap.status = 'CANCELLED';
        await swap.save();
        
        await logAudit(
          null, // system action
          'SwapRequest',
          swap.id,
          'CANCEL_EXPIRED_DROP',
          before,
          swap.toJSON()
        );

        await notify(
          swap.requesterId,
          'DROP_EXPIRED',
          'Your drop request expired without being claimed.',
          { swapRequestId: swap.id },
          io
        );

        if (io) {
          io.to(`user:${swap.requesterId}`).emit('swap:statusChanged', {
            swapRequestId: swap.id,
            newStatus: 'CANCELLED',
          });
        }
      }
    } 
    else if (job.name === 'cancelSwapOnShiftEdit') {
      const { swapRequestId, editedBy } = job.data;
      const swap = await SwapRequest.findByPk(swapRequestId);
      
      if (swap && swap.status === 'PENDING_MANAGER') {
        const before = swap.toJSON();
        swap.status = 'CANCELLED';
        await swap.save();

        // Restore original ShiftAssignment back to 'assigned'
        const assignment = await ShiftAssignment.findOne({
          where: { shiftId: swap.shiftId, userId: swap.requesterId }
        });
        if (assignment) {
          assignment.status = 'assigned';
          await assignment.save();
        }

        await logAudit(
          editedBy,
          'SwapRequest',
          swap.id,
          'CANCEL_SWAP_ON_SHIFT_EDIT',
          before,
          swap.toJSON()
        );

        // Notify requester
        await notify(
          swap.requesterId,
          'SWAP_CANCELLED',
          'Your swap request was cancelled because the shift was modified by a manager.',
          { swapRequestId: swap.id },
          io
        );

        // Notify target if it was a swap (not an open drop)
        if (swap.targetId) {
          await notify(
            swap.targetId,
            'SWAP_CANCELLED',
            'A pending swap you accepted was cancelled because the shift was modified.',
            { swapRequestId: swap.id },
            io
          );
        }

        if (io) {
          io.to(`user:${swap.requesterId}`).emit('swap:statusChanged', {
            swapRequestId: swap.id,
            newStatus: 'CANCELLED',
          });
          if (swap.targetId) {
            io.to(`user:${swap.targetId}`).emit('swap:statusChanged', {
              swapRequestId: swap.id,
              newStatus: 'CANCELLED',
            });
          }
        }
      }
    }
  }, {
    connection: redisClient
  });

  swapWorker.on('error', err => {
    console.error('Swap Worker Error:', err);
  });

  return swapWorker;
}
