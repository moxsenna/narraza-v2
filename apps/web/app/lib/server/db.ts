/**
 * Web composition root — the ONLY place apps/web may import @narraza/db.
 *
 * Pages / route handlers / Server Actions must import from here (or sibling
 * helpers under lib/server), never from @narraza/db directly.
 */

import { getPrisma as getPrismaClient } from '@narraza/db/client.js';
import {
  createPrismaUnitOfWork as createUow,
  createPrismaOperationalUnitOfWork as createOpUow,
} from '@narraza/db/unit-of-work.js';
import { createProjectRepo as _createProjectRepo } from '@narraza/db/repositories/project-repo.js';
import { createUserRepo as _createUserRepo } from '@narraza/db/repositories/user-repo.js';
import { createSessionRepo as _createSessionRepo } from '@narraza/db/repositories/session-repo.js';
import { createChallengeRepo as _createChallengeRepo } from '@narraza/db/repositories/challenge-repo.js';
import { createLedgerRepo as _createLedgerRepo } from '@narraza/db/repositories/ledger-repo.js';
import { createFoundationRepo as _createFoundationRepo } from '@narraza/db/repositories/foundation-repo.js';
import { createCharacterRepo as _createCharacterRepo } from '@narraza/db/repositories/character-repo.js';
import { createChangeSetRepo as _createChangeSetRepo } from '@narraza/db/repositories/change-set-repo.js';

export function getPrisma() {
  return getPrismaClient();
}

export function createPrismaUnitOfWork() {
  return createUow(getPrismaClient());
}

export function createPrismaOperationalUnitOfWork() {
  return createOpUow(getPrismaClient());
}

export function createProjectRepo() {
  return _createProjectRepo();
}

export function createUserRepo() {
  return _createUserRepo();
}

export function createSessionRepo() {
  return _createSessionRepo();
}

export function createChallengeRepo() {
  return _createChallengeRepo();
}

export function createLedgerRepo() {
  return _createLedgerRepo();
}

export function createFoundationRepo() {
  return _createFoundationRepo();
}

export function createCharacterRepo() {
  return _createCharacterRepo();
}

export function createChangeSetRepo() {
  return _createChangeSetRepo();
}

/** Auth ports bundle used by magic-link use cases. */
export function createAuthPorts() {
  return {
    challengeRepo: createChallengeRepo(),
    userRepo: createUserRepo(),
    sessionRepo: createSessionRepo(),
    ledgerRepo: createLedgerRepo(),
  };
}
