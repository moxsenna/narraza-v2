import type { Prisma } from '@prisma/client';
import type { OutboxConsumerReceipt, CreateOutboxConsumerReceiptInput, OutboxConsumerReceiptRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxOutboxConsumerReceiptRepo(tx: TxClient): OutboxConsumerReceiptRepo {
  function toDTO(r: any): OutboxConsumerReceipt {
    return {
      id: r.id,
      consumerName: r.consumer_name ?? r.consumerName,
      eventId: r.event_id ?? r.eventId,
      deliveryGeneration: r.delivery_generation ?? r.deliveryGeneration,
      status: r.status as OutboxConsumerReceipt['status'],
      createdAt: r.created_at ?? r.createdAt,
      updatedAt: r.updated_at ?? r.updatedAt,
    };
  }

  return {
    async create(input: CreateOutboxConsumerReceiptInput): Promise<OutboxConsumerReceipt> {
      const r = await tx.outboxConsumerReceipt.create({
        data: {
          consumerName: input.consumerName,
          eventId: input.eventId,
          deliveryGeneration: input.deliveryGeneration,
        },
      });
      return toDTO(r);
    },
    async findById(id: string): Promise<OutboxConsumerReceipt | null> {
      const r = await tx.outboxConsumerReceipt.findUnique({ where: { id } });
      return r ? toDTO(r) : null;
    },
    async findByEventAndConsumer(eventId: string, consumerName: string, deliveryGeneration: number): Promise<OutboxConsumerReceipt | null> {
      const r = await tx.outboxConsumerReceipt.findFirst({
        where: { eventId, consumerName, deliveryGeneration },
      });
      return r ? toDTO(r) : null;
    },
    async markCompleted(id: string): Promise<OutboxConsumerReceipt | null> {
      try {
        // Allow complete from processing or uncertain (re-drive after external side effect)
        const r = await tx.outboxConsumerReceipt.update({
          where: { id, status: { in: ['processing', 'uncertain'] } },
          data: { status: 'completed' },
        });
        return toDTO(r);
      } catch {
        return null;
      }
    },
    async markUncertain(id: string): Promise<OutboxConsumerReceipt | null> {
      try {
        const r = await tx.outboxConsumerReceipt.update({
          where: { id, status: 'processing' },
          data: { status: 'uncertain' },
        });
        return toDTO(r);
      } catch {
        return null;
      }
    },
    async markDead(id: string): Promise<OutboxConsumerReceipt | null> {
      try {
        const r = await tx.outboxConsumerReceipt.update({
          where: { id, status: { in: ['uncertain', 'processing'] } },
          data: { status: 'dead' },
        });
        return toDTO(r);
      } catch {
        return null;
      }
    },
    async listUnresolved(consumerName: string, limit: number): Promise<OutboxConsumerReceipt[]> {
      const rows = await tx.outboxConsumerReceipt.findMany({
        where: {
          consumerName,
          status: { in: ['processing', 'uncertain'] },
        },
        take: limit,
      });
      return rows.map(toDTO);
    },
  };
}
