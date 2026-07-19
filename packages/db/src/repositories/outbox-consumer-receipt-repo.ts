import type { OutboxConsumerReceipt, CreateOutboxConsumerReceiptInput, OutboxConsumerReceiptRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createOutboxConsumerReceiptRepo(): OutboxConsumerReceiptRepo {
  const prisma = getPrisma();

  function toDTO(r: Record<string, unknown>): OutboxConsumerReceipt {
    return {
      id: r.id as string,
      consumerName: (r.consumerName ?? r.consumer_name) as string,
      eventId: (r.eventId ?? r.event_id) as string,
      deliveryGeneration: (r.deliveryGeneration ?? r.delivery_generation) as number,
      status: r.status as OutboxConsumerReceipt['status'],
      createdAt: (r.createdAt ?? r.created_at) as Date,
      updatedAt: (r.updatedAt ?? r.updated_at) as Date,
    };
  }

  return {
    async create(input: CreateOutboxConsumerReceiptInput): Promise<OutboxConsumerReceipt> {
      const r = await prisma.outboxConsumerReceipt.create({
        data: {
          consumerName: input.consumerName,
          eventId: input.eventId,
          deliveryGeneration: input.deliveryGeneration,
        },
      });
      return toDTO(r as unknown as Record<string, unknown>);
    },
    async findById(id: string): Promise<OutboxConsumerReceipt | null> {
      const r = await prisma.outboxConsumerReceipt.findUnique({ where: { id } });
      return r ? toDTO(r as unknown as Record<string, unknown>) : null;
    },
    async findByEventAndConsumer(eventId: string, consumerName: string, deliveryGeneration: number): Promise<OutboxConsumerReceipt | null> {
      const r = await prisma.outboxConsumerReceipt.findFirst({
        where: { eventId, consumerName, deliveryGeneration },
      });
      return r ? toDTO(r as unknown as Record<string, unknown>) : null;
    },
    async markCompleted(id: string): Promise<OutboxConsumerReceipt | null> {
      try {
        const r = await prisma.outboxConsumerReceipt.update({
          where: { id, status: 'processing' },
          data: { status: 'completed' },
        });
        return toDTO(r as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async markUncertain(id: string): Promise<OutboxConsumerReceipt | null> {
      try {
        const r = await prisma.outboxConsumerReceipt.update({
          where: { id, status: 'processing' },
          data: { status: 'uncertain' },
        });
        return toDTO(r as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async markDead(id: string): Promise<OutboxConsumerReceipt | null> {
      try {
        const r = await prisma.outboxConsumerReceipt.update({
          where: { id, status: { in: ['uncertain', 'processing'] } },
          data: { status: 'dead' },
        });
        return toDTO(r as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async listUnresolved(consumerName: string, limit: number): Promise<OutboxConsumerReceipt[]> {
      const rows = await prisma.outboxConsumerReceipt.findMany({
        where: {
          consumerName,
          status: { in: ['processing', 'uncertain'] },
        },
        take: limit,
      });
      return rows.map((r) => toDTO(r as unknown as Record<string, unknown>));
    },
  };
}
