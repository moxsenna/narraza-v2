import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token');

  if (!rawToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const { prepareConfirm } = await import(
    '@narraza/application/use-cases/auth/prepare-confirm.js'
  );
  const { getPrisma } = await import('@narraza/db/client.js');
  const { createChallengeRepo } = await import(
    '@narraza/db/repositories/challenge-repo.js'
  );
  const { createUserRepo } = await import(
    '@narraza/db/repositories/user-repo.js'
  );
  const { createSessionRepo } = await import(
    '@narraza/db/repositories/session-repo.js'
  );
  const { createLedgerRepo } = await import(
    '@narraza/db/repositories/ledger-repo.js'
  );

  const ports = {
    challengeRepo: createChallengeRepo(),
    userRepo: createUserRepo(),
    sessionRepo: createSessionRepo(),
    ledgerRepo: createLedgerRepo(),
  };

  const pepper = process.env.EMAIL_CHALLENGE_PEPPER!;
  const authSecret = process.env.AUTH_SECRET!;
  const authUrl = process.env.AUTH_URL!;

  const result = await prepareConfirm(ports, { rawToken }, pepper, authSecret, authUrl);

  const response = NextResponse.redirect(new URL('/auth/email/confirm', request.url));
  response.headers.set('Set-Cookie', result.setCookieHeader);
  return response;
}

export async function POST(request: NextRequest) {
  const pendingCookie = request.cookies.get('pending_login');

  if (!pendingCookie?.value) {
    return NextResponse.json({ error: 'Missing pending login cookie' }, { status: 401 });
  }

  const { consumeChallenge } = await import(
    '@narraza/application/use-cases/auth/consume-challenge.js'
  );
  const { formatClearPendingCookie } = await import(
    '@narraza/application/use-cases/auth/pending-login-cookie.js'
  );
  const { getPrisma } = await import('@narraza/db/client.js');
  const { createChallengeRepo } = await import(
    '@narraza/db/repositories/challenge-repo.js'
  );
  const { createUserRepo } = await import(
    '@narraza/db/repositories/user-repo.js'
  );
  const { createSessionRepo } = await import(
    '@narraza/db/repositories/session-repo.js'
  );
  const { createLedgerRepo } = await import(
    '@narraza/db/repositories/ledger-repo.js'
  );

  const ports = {
    challengeRepo: createChallengeRepo(),
    userRepo: createUserRepo(),
    sessionRepo: createSessionRepo(),
    ledgerRepo: createLedgerRepo(),
  };

  const authSecret = process.env.AUTH_SECRET!;
  const signupGrantMicro = BigInt(process.env.SIGNUP_GRANT_MICRO_IDR ?? '5000000000');

  const result = await consumeChallenge(
    ports,
    { pendingCookieValue: pendingCookie.value },
    authSecret,
    signupGrantMicro,
  );

  // Set session cookie
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set('session_token', result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Clear pending login cookie
  response.headers.append('Set-Cookie', formatClearPendingCookie());

  return response;
}
