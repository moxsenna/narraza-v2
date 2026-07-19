/**
 * P3.8 — Structured AI job logging with redaction.
 * Never log API keys, auth headers, full hidden truths, or full manuscripts by default.
 */

export interface AiJobLogFields {
  jobType: string;
  operationId: string;
  traceId: string;
  providerInternal: string;
  modelInternal: string;
  promptContractVersion: string;
  contextCompilerVersion: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  retryCount: number;
  resultStatus: 'success' | 'error' | 'cancelled' | 'firewall_block' | 'incomplete_context';
  validationStatus?: 'passed' | 'failed' | 'skipped';
  blockingFindingCount?: number;
  errorCode?: string;
}

const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{10,}/g,
  /Bearer\s+\S+/gi,
  /api[_-]?key["\s:=]+\S+/gi,
  /authorization["\s:=]+\S+/gi,
];

export function redactSensitive(text: string): string {
  let out = text;
  for (const re of SENSITIVE_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  return out;
}

/**
 * Emit one structured log line (JSON). Safe for CI capture.
 */
export function logAiJobEvent(fields: AiJobLogFields): void {
  const line = {
    type: 'ai_job',
    ts: new Date().toISOString(),
    ...fields,
  };
  // eslint-disable-next-line no-console
  console.info(redactSensitive(JSON.stringify(line)));
}
