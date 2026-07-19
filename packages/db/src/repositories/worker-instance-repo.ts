import type { WorkerInstance, CreateWorkerInstanceInput, WorkerInstanceRepo } from '@narraza/application';
import { getPrisma } from '../client.js';

export function createWorkerInstanceRepo(): WorkerInstanceRepo {
  const prisma = getPrisma();

  function toDTO(r: Record<string, unknown>): WorkerInstance {
    return {
      id: r.id as string,
      instanceId: (r.instanceId ?? r.instance_id) as string,
      role: r.role as string,
      lastHeartbeatAt: (r.lastHeartbeatAt ?? r.last_heartbeat_at) as Date,
      draining: r.draining as boolean,
      createdAt: (r.createdAt ?? r.created_at) as Date,
      updatedAt: (r.updatedAt ?? r.updated_at) as Date,
    };
  }

  return {
    async create(input: CreateWorkerInstanceInput): Promise<WorkerInstance> {
      const r = await prisma.workerInstance.create({
        data: {
          instanceId: input.instanceId,
          role: input.role,
          lastHeartbeatAt: new Date(),
        },
      });
      return toDTO(r as unknown as Record<string, unknown>);
    },
    async heartbeat(instanceId: string): Promise<WorkerInstance | null> {
      try {
        const r = await prisma.workerInstance.update({
          where: { instanceId },
          data: { lastHeartbeatAt: new Date() },
        });
        return toDTO(r as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async setDraining(instanceId: string, draining: boolean): Promise<WorkerInstance | null> {
      try {
        const r = await prisma.workerInstance.update({
          where: { instanceId },
          data: { draining },
        });
        return toDTO(r as unknown as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    async findById(instanceId: string): Promise<WorkerInstance | null> {
      const r = await prisma.workerInstance.findUnique({ where: { instanceId } });
      return r ? toDTO(r as unknown as Record<string, unknown>) : null;
    },
    async listStaleHeartbeats(threshold: Date, limit: number): Promise<WorkerInstance[]> {
      const rows = await prisma.workerInstance.findMany({
        where: { lastHeartbeatAt: { lt: threshold } },
        take: limit,
      });
      return rows.map((r) => toDTO(r as unknown as Record<string, unknown>));
    },
  };
}
