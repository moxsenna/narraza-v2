import type { AttemptCostExposure, CreateAttemptCostExposureInput, AttemptCostExposureRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createAttemptCostExposureRepo(): AttemptCostExposureRepo {
  const prisma = getPrisma();

  function rowToDTO(row: { id: string; generationAttemptId: string; reservationId: string; estimatedAmountMicro: bigint; actualAmountMicro: bigint | null; status: string; createdAt: Date; updatedAt: Date }): AttemptCostExposure {
    return {
      ...row,
      status: row.status as AttemptCostExposure['status'],
    };
  }

  return {
    async create(input: CreateAttemptCostExposureInput): Promise<AttemptCostExposure> {
      const row = await prisma.attemptCostExposure.create({
        data: {
          generationAttemptId: input.generationAttemptId,
          reservationId: input.reservationId,
          estimatedAmountMicro: input.estimatedAmountMicro,
          status: 'open',
        },
      });
      return rowToDTO(row);
    },

    async findById(id: string): Promise<AttemptCostExposure | null> {
      const row = await prisma.attemptCostExposure.findUnique({ where: { id } });
      return row ? rowToDTO(row) : null;
    },

    async findByReservationId(reservationId: string): Promise<AttemptCostExposure[]> {
      const rows = await prisma.attemptCostExposure.findMany({
        where: { reservationId },
      });
      return rows.map(rowToDTO);
    },

    async findByAttemptId(generationAttemptId: string): Promise<AttemptCostExposure[]> {
      const rows = await prisma.attemptCostExposure.findMany({
        where: { generationAttemptId },
      });
      return rows.map(rowToDTO);
    },

    async listOpenByReservationId(reservationId: string): Promise<AttemptCostExposure[]> {
      const rows = await prisma.attemptCostExposure.findMany({
        where: { reservationId, status: 'open' },
      });
      return rows.map(rowToDTO);
    },

    async settle(id: string, actualAmountMicro: bigint): Promise<AttemptCostExposure | null> {
      try {
        const row = await prisma.attemptCostExposure.update({
          where: { id },
          data: {
            status: 'settled',
            actualAmountMicro,
          },
        });
        return rowToDTO(row);
      } catch {
        return null;
      }
    },

    async release(id: string): Promise<AttemptCostExposure | null> {
      try {
        const row = await prisma.attemptCostExposure.update({
          where: { id },
          data: { status: 'released' },
        });
        return rowToDTO(row);
      } catch {
        return null;
      }
    },
  };
}
