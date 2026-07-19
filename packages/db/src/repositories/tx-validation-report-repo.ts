import type { Prisma } from '@prisma/client';
import type {
  ValidationReportRepo,
  ValidationReportEntry,
  CreateValidationReportInput,
} from '@narraza/application';

type TxClient = Prisma.TransactionClient;

export function createTxValidationReportRepo(
  tx: TxClient,
): ValidationReportRepo {
  function mapReport(row: any): ValidationReportEntry {
    return {
      id: row.id,
      proseVersionId: row.proseVersionId,
      candidateId: row.candidateId,
      passed: row.passed,
      findings: row.findings as ValidationReportEntry['findings'],
      contentHash: row.contentHash,
      createdAt: row.createdAt,
    };
  }

  return {
    async create(
      input: CreateValidationReportInput,
    ): Promise<ValidationReportEntry> {
      const row = await (tx as any).validationReport.create({
        data: {
          proseVersionId: input.proseVersionId,
          candidateId: input.candidateId ?? null,
          passed: input.passed,
          findings: input.findings as any,
          contentHash: input.contentHash,
        },
      });
      return mapReport(row);
    },

    async findById(id: string): Promise<ValidationReportEntry | null> {
      const row = await (tx as any).validationReport.findUnique({
        where: { id },
      });
      if (!row) return null;
      return mapReport(row);
    },

    async findByProseVersionId(
      proseVersionId: string,
    ): Promise<ValidationReportEntry | null> {
      const row = await (tx as any).validationReport.findFirst({
        where: { proseVersionId },
      });
      if (!row) return null;
      return mapReport(row);
    },

    async findLatestByProseVersionId(
      proseVersionId: string,
    ): Promise<ValidationReportEntry | null> {
      const row = await (tx as any).validationReport.findFirst({
        where: { proseVersionId },
        orderBy: { createdAt: 'desc' },
      });
      if (!row) return null;
      return mapReport(row);
    },

    async findValidReport(
      proseVersionId: string,
      contentHash: string,
    ): Promise<ValidationReportEntry | null> {
      const row = await (tx as any).validationReport.findFirst({
        where: { proseVersionId, contentHash, passed: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!row) return null;
      return mapReport(row);
    },
  };
}
