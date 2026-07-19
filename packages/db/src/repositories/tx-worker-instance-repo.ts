import type { Prisma } from '@prisma/client';
import type { WorkerInstance, CreateWorkerInstanceInput, WorkerInstanceRepo } from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxWorkerInstanceRepo(tx: TxClient): WorkerInstanceRepo {
  function toDTO(r: any): WorkerInstance {
    return {
      id: r.id,
      instanceId: r.instance_id ?? r.instanceId,
      role: r.role,
      lastHeartbeatAt: r.last_heartbeat_at ?? r.lastHeartbeatAt,
      draining: r.draining,
      createdAt: r.created_at ?? r.createdAt,
      updatedAt: r.updated_at ?? r.updatedAt,
    };
  }

  return {
    async create(input: CreateWorkerInstanceInput): Promise<WorkerInstance> {
      const r = await tx.workerInstance.create({
        data: {
          instanceId: input.instanceId,
          role: input.role,
          lastHeartbeatAt: new Date(),
        },
      });
      return toDTO(r);
    },
    async heartbeat(instanceId: string): Promise<WorkerInstance | null> {
      try {
        const r = await tx.workerInstance.update({
          where: { instanceId },
          data: { lastHeartbeatAt: new Date() },
        });
        return toDTO(r);
      } catch {
        return null;
      }
    },
    async setDraining(instanceId: string, draining: boolean): Promise<WorkerInstance | null> {
      try {
        const r = await tx.workerInstance.update({
          where: { instanceId },
          data: { draining },
        });
        return toDTO(r);
      } catch {
        return null;
      }
    },
    async findById(instanceId: string): Promise<WorkerInstance | null> {
      const r = await tx.workerInstance.findUnique({ where: { instanceId } });
      return r ? toDTO(r) : null;
    },
    async listStaleHeartbeats(threshold: Date, limit: number): Promise<WorkerInstance[]> {
      const rows = await tx.workerInstance.findMany({
        where: { lastHeartbeatAt: { lt: threshold } },
        take: limit,
      });
      return rows.map(toDTO);
    },
  };
}
