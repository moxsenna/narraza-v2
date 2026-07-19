import type { Prisma } from '@prisma/client';
import type { OutboxEvent, CreateOutboxEventInput, OutboxEventRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxOutboxEventRepo(tx: TxClient): OutboxEventRepo {
  function toDTO(r: any): OutboxEvent {
    return {
      id: r.id,
      dedupeKey: r.dedupe_key ?? r.dedupeKey,
      status: r.status as OutboxEvent['status'],
      payload: r.payload as Record<string, unknown>,
      availableAt: r.available_at ?? r.availableAt,
      deliveryGeneration: r.delivery_generation ?? r.deliveryGeneration,
      createdAt: r.created_at ?? r.createdAt,
      updatedAt: r.updated_at ?? r.updatedAt,
    };
  }

  return {
    async create(input: CreateOutboxEventInput): Promise<OutboxEvent> {
      const r = await tx.outboxEvent.create({
        data: {
          dedupeKey: input.dedupeKey,
          payload: input.payload as any,
          availableAt: input.availableAt ?? new Date(),
        },
      });
      return toDTO(r);
    },
    async findById(id: string): Promise<OutboxEvent | null> {
      const r = await tx.outboxEvent.findUnique({ where: { id } });
      return r ? toDTO(r) : null;
    },
    async findByDedupeKey(dedupeKey: string): Promise<OutboxEvent | null> {
      const r = await tx.outboxEvent.findFirst({ where: { dedupeKey }, orderBy: { createdAt: 'desc' } });
      return r ? toDTO(r) : null;
    },
    async claimForProcessing(id: string, deliveryGeneration: number): Promise<OutboxEvent | null> {
      try {
        const r = await tx.outboxEvent.update({
          where: { id, status: 'pending' },
          data: { status: 'processing', deliveryGeneration },
        });
        return toDTO(r);
      } catch {
        return null;
      }
    },
    async markCompleted(id: string): Promise<OutboxEvent | null> {
      try {
        const r = await tx.outboxEvent.update({
          where: { id },
          data: { status: 'completed' },
        });
        return toDTO(r);
      } catch {
        return null;
      }
    },
    async markDeadAndBump(id: string, newDeliveryGeneration: number): Promise<OutboxEvent | null> {
      try {
        const r = await tx.outboxEvent.update({
          where: { id },
          data: { status: 'dead', deliveryGeneration: newDeliveryGeneration },
        });
        return toDTO(r);
      } catch {
        return null;
      }
    },
    async pollPending(limit: number): Promise<OutboxEvent[]> {
      const rows = await tx.outboxEvent.findMany({
        where: {
          status: 'pending',
          availableAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return rows.map(toDTO);
    },
  };
}
