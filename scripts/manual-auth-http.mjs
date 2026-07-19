import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import {
  issueChallenge,
  prepareConfirm,
  consumeChallenge,
  sendDevMail,
} from '@narraza/application';
import { createChallengeRepo } from '@narraza/db/repositories/challenge-repo.js';
import { createUserRepo } from '@narraza/db/repositories/user-repo.js';
import { createSessionRepo } from '@narraza/db/repositories/session-repo.js';
import { createLedgerRepo } from '@narraza/db/repositories/ledger-repo.js';

config({ path: 'D:/Coding/Narraza Fix/narraza v2/.env' });

const ports = {
  challengeRepo: createChallengeRepo(),
  userRepo: createUserRepo(),
  sessionRepo: createSessionRepo(),
  ledgerRepo: createLedgerRepo(),
};

const pepper = process.env.EMAIL_CHALLENGE_PEPPER;
const secret = process.env.AUTH_SECRET;
const email = `manual-http-${Date.now()}@narraza.test`;
const mailDir = process.env.MAIL_FILE_DIR;

console.log('env ok', !!pepper, !!secret, mailDir);

const issued = await issueChallenge(ports, { email }, pepper);
console.log('issued', issued.challengeId);

await sendDevMail(mailDir, {
  to: email,
  subject: 't',
  body: `token=${issued.rawToken}`,
  challengeId: issued.challengeId,
});

// HTTP prepare
const prepRes = await fetch(
  `http://localhost:3000/auth/email/prepare?token=${encodeURIComponent(issued.rawToken)}`,
  { redirect: 'manual' },
);
console.log('prepare status', prepRes.status, prepRes.headers.get('location'));
const setCookie = prepRes.headers.getSetCookie?.() ?? [];
console.log('set-cookie', setCookie);
const pending = setCookie
  .map((c) => c.split(';')[0])
  .find((c) => c.startsWith('pending_login='));
console.log('pending cookie header part', pending?.slice(0, 80));

if (!pending) {
  const body = await prepRes.text();
  console.log('prepare body', body.slice(0, 500));
  process.exit(1);
}

const confirmRes = await fetch('http://localhost:3000/auth/email/consume', {
  method: 'POST',
  redirect: 'manual',
  headers: { Cookie: pending },
});
console.log(
  'confirm status',
  confirmRes.status,
  confirmRes.headers.get('location'),
);
const body = await confirmRes.text();
console.log('confirm body', body.slice(0, 300));
console.log('confirm set-cookie', confirmRes.headers.getSetCookie?.());
