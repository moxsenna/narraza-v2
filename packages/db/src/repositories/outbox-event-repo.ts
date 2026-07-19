import type { OutboxEvent, CreateOutboxEventInput, OutboxEventRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createOutboxEventRepo(): OutboxEventRepo {
  const prisma = getPrisma();

  function toDTO(r: Record<string, unknown>): OutboxEvent {
    return {
      id: r.id as string,
      dedupeKey: (r.dedupeKey ?? r.dedupe_key) as string,
      status: r.status as OutboxEvent['status'],
      payload: r.payload as Record<string, unknown>,
      availableAt: (r.availableAt ?? r.available_at) as Date,
      deliveryGeneration: (r.deliveryGeneration ?? r.delivery_generation) as number,
      createdAt: (r.createdAt ?? r.created_at) as Date,
      updatedAt: (r.updatedAt ?? r.updated_at) as Date,
    };
  }

  return {
    async create(input: CreateOutboxEventInput): Promise<OutboxEvent> {
      const r = await prisma.outboxEvent.create({
        data: {
          dedupeKey: input.dedupeKey,
          payload: input.payload as any,
          availableAt: input.availableAt ?? new Date(),
        },
      });
      return toDTO(r as unknown as Record<string, unknown>);
    },
    async findById(id: string): Promise<OutboxEvent | null> {
      const r = await prisma.outboxEvent.findUnique({ where: { id } });
      return r ? toDTO(r as unknown as Record<string, unknown>) : null;
    },
    async findByDedupeKey(dedupeKey: string): Promise<OutboxEvent | null> {
      const r = await prisma.outboxEvent.findFirst({
        where: { dedupeKey },
        orderBy: { createdAt: 'desc' },
      });
      return r ? toDTO(r as unknown as Record<string, unknown>) : null;
    },
    async claimForProcessing(id: string, deliveryGeneration: number): Promise<OutboxEvent | null> {
      try {
        const r = await prisma.outboxEvent.update({
          where: { id, status: 'pending' },
          data: { status: 'processing', deliveryGeneration },
        });
        return toDTO(r as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async markCompleted(id: string): Promise<OutboxEvent | null> {
      try {
        const r = await prisma.outboxEvent.update({
          where: { id },
          data: { status: 'completed' },
        });
        return toDTO(r as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async markDeadAndBump(id: string, newDeliveryGeneration: number): Promise<OutboxEvent | null> {
      try {
        const r = await prisma.outboxEvent.update({
          where: { id },
          data: { status: 'dead', deliveryGeneration: newDeliveryGeneration },
        });
        return toDTO(r as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async pollPending(limit: number): Promise<OutboxEvent[]> {
      const rows = await prisma.outboxEvent.findMany({
        where: {
          status: 'pending',
          availableAt: { lte: new Date() },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return rows.map((r) => toDTO(r as unknown as Record<string, unknown>));
    },
  };
}
