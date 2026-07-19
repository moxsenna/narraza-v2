import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface MailMessage {
  to: string;
  subject: string;
  body: string;
  challengeId: string;
}

/**
 * Write mail to .data/mail/{challengeId}.txt for dev/testing.
 * Never logs raw token.
 */
export async function sendDevMail(
  mailFileDir: string,
  message: MailMessage,
): Promise<void> {
  const dir = path.resolve(mailFileDir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${message.challengeId}.txt`);

  const content = [
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    '',
    message.body,
  ].join('\n');

  await fs.writeFile(filePath, content, 'utf-8');
}
