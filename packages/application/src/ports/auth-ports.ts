export interface EmailLoginChallenge {
  id: string;
  userId: string | null;
  identifierNormalized: string;
  tokenHash: string;
  nonce: string;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  expiresAt: Date;
  lastActiveAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface User {
  id: string;
  email: string;
  emailNormalized: string;
  name: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreditLedgerEntry {
  id: string;
  userId: string;
  entryType: string;
  amountMicro: bigint;
  dedupeKey: string;
  createdAt: Date;
}

export interface CreateChallengeInput {
  identifierNormalized: string;
  tokenHash: string;
  nonce: string;
  expiresAt: Date;
}

export interface ChallengeRepo {
  create(input: CreateChallengeInput): Promise<EmailLoginChallenge>;
  findByTokenHash(tokenHash: string): Promise<EmailLoginChallenge | null>;
  findById(id: string): Promise<EmailLoginChallenge | null>;
  /** Count active (not consumed, not revoked, not expired) challenges for identifier */
  countActiveByIdentifier(identifierNormalized: string): Promise<number>;
  /** Revoke the oldest active challenge for identifier, returns it or null */
  revokeOldestActive(identifierNormalized: string): Promise<EmailLoginChallenge | null>;
  /** CAS consume: sets consumedAt only if not consumed, not revoked, not expired. Returns updated row or null. */
  consumeIfValid(id: string): Promise<EmailLoginChallenge | null>;
  /** Revoke all active challenges for identifier (used after successful login) */
  revokeAllActive(identifierNormalized: string): Promise<number>;
  /** Direct update for test helpers */
  updateExpiresAt(id: string, expiresAt: Date): Promise<void>;
  updateRevokedAt(id: string, revokedAt: Date): Promise<void>;
}

export interface UserRepo {
  findByEmailNormalized(emailNormalized: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: { email: string; emailNormalized: string; status?: string }): Promise<User>;
}

export interface SessionRepo {
  create(input: { sessionToken: string; userId: string; expiresAt: Date }): Promise<Session>;
  revokeAllByUserId(userId: string): Promise<number>;
  revokeBySessionToken(sessionToken: string): Promise<Session | null>;
  findBySessionToken(sessionToken: string): Promise<Session | null>;
}

export interface LedgerRepo {
  create(input: {
    userId: string;
    entryType: string;
    amountMicro: bigint;
    dedupeKey: string;
  }): Promise<CreditLedgerEntry>;
  findByDedupeKey(dedupeKey: string): Promise<CreditLedgerEntry | null>;
  countByDedupeKey(dedupeKey: string): Promise<number>;
}

export interface AuthPorts {
  challengeRepo: ChallengeRepo;
  userRepo: UserRepo;
  sessionRepo: SessionRepo;
  ledgerRepo: LedgerRepo;
}
