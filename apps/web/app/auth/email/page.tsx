import { redirect } from 'next/navigation';

export default function AuthEmailPage() {
  return (
    <div style={{ maxWidth: 400, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Login to Narraza</h1>
      <form
        action={async (formData: FormData) => {
          'use server';
          const email = formData.get('email') as string;
          if (!email || !email.includes('@')) {
            throw new Error('Invalid email');
          }

          const { issueChallenge, sendDevMail } = await import(
            '@narraza/application'
          );
          const { createAuthPorts } = await import(
            '../../lib/server/db'
          );

          const ports = createAuthPorts();

          const pepper = process.env.EMAIL_CHALLENGE_PEPPER!;
          const result = await issueChallenge(ports, { email }, pepper);

          const link = `${process.env.AUTH_URL}/auth/email/prepare?token=${result.rawToken}`;
          const mailDir = process.env.MAIL_FILE_DIR ?? '.data/mail';

          if ((process.env.MAIL_TRANSPORT ?? 'file') === 'file') {
            await sendDevMail(mailDir, {
              to: email,
              subject: 'Your Narraza login link',
              body: `Use this link to log in to Narraza:\n\n${link}\n\nThis link expires in 10 minutes.`,
              challengeId: result.challengeId,
            });
          }

          redirect('/auth/email/check');
        }}
      >
        <label>
          Email address
          <input
            type="email"
            name="email"
            required
            style={{ display: 'block', width: '100%', padding: 8, margin: '8px 0' }}
          />
        </label>
        <button type="submit" style={{ padding: '8px 16px' }}>
          Send magic link
        </button>
      </form>
    </div>
  );
}
