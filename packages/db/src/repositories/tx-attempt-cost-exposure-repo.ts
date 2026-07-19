import type { Prisma } from '@prisma/client';
import type { AttemptCostExposure, CreateAttemptCostExposureInput, AttemptCostExposureRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxAttemptCostExposureRepo(tx: TxClient): AttemptCostExposureRepo {
  function dto(r: any): AttemptCostExposure {
    return { ...r, status: r.status as AttemptCostExposure['status'] };
  }
  return {
    async create(input: CreateAttemptCostExposureInput): Promise<AttemptCostExposure> {
      const r = await tx.attemptCostExposure.create({
        data: { generationAttemptId: input.generationAttemptId, reservationId: input.reservationId, estimatedAmountMicro: input.estimatedAmountMicro, status: 'open' },
      });
      return dto(r);
    },
    async findById(id: string): Promise<AttemptCostExposure | null> { const r = await tx.attemptCostExposure.findUnique({ where: { id } }); return r ? dto(r) : null; },
    async findByReservationId(reservationId: string): Promise<AttemptCostExposure[]> { const rs = await tx.attemptCostExposure.findMany({ where: { reservationId } }); return rs.map(dto); },
    async findByAttemptId(attemptId: string): Promise<AttemptCostExposure[]> { const rs = await tx.attemptCostExposure.findMany({ where: { generationAttemptId: attemptId } }); return rs.map(dto); },
    async listOpenByReservationId(reservationId: string): Promise<AttemptCostExposure[]> { const rs = await tx.attemptCostExposure.findMany({ where: { reservationId, status: 'open' } }); return rs.map(dto); },
    async settle(id: string, actualAmountMicro: bigint): Promise<AttemptCostExposure | null> {
      try { const r = await tx.attemptCostExposure.update({ where: { id }, data: { status: 'settled', actualAmountMicro } }); return dto(r); } catch { return null; }
    },
    async release(id: string): Promise<AttemptCostExposure | null> {
      try { const r = await tx.attemptCostExposure.update({ where: { id }, data: { status: 'released' } }); return dto(r); } catch { return null; }
    },
  };
}
