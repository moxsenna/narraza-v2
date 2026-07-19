import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /auth/email/confirm
 * Consumes pending_login cookie, creates session, redirects to dashboard.
 */
export async function POST(request: NextRequest) {
  const pendingCookie = request.cookies.get('pending_login');

  if (!pendingCookie?.value) {
    return NextResponse.json(
      { error: 'Missing pending login cookie' },
      { status: 401 },
    );
  }

  try {
    const { consumeChallenge } = await import('@narraza/application');
    const { createAuthPorts } = await import(
      '../../../lib/server/db'
    );

    const ports = createAuthPorts();

    const authSecret = process.env.AUTH_SECRET!;
    const signupGrantMicro = BigInt(
      process.env.SIGNUP_GRANT_MICRO_IDR ?? '5000000000',
    );

    const result = await consumeChallenge(
      ports,
      { pendingCookieValue: pendingCookie.value },
      authSecret,
      signupGrantMicro,
    );

    const response = NextResponse.redirect(
      new URL('/dashboard', request.url),
      303,
    );
    response.cookies.set('session_token', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    response.cookies.set('pending_login', '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
