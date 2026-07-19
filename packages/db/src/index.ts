// @narraza/db barrel — re-exports client and UoW factories
export { getPrisma, setPrisma } from './client.js';
export type { PrismaClient } from './client.js';
export { createPrismaUnitOfWork, createPrismaOperationalUnitOfWork } from './unit-of-work.js';
