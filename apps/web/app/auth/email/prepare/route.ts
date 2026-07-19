import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /auth/email/prepare?token=RAW
 * Validates token without consume, sets pending_login cookie, 303 to clean confirm URL.
 */
export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token');

  if (!rawToken) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const { prepareConfirm } = await import('@narraza/application');
    const { createAuthPorts } = await import(
      '../../../lib/server/db'
    );

    const ports = createAuthPorts();

    const pepper = process.env.EMAIL_CHALLENGE_PEPPER!;
    const authSecret = process.env.AUTH_SECRET!;
    const authUrl = process.env.AUTH_URL ?? 'http://localhost:3000';

    const result = await prepareConfirm(
      ports,
      { rawToken },
      pepper,
      authSecret,
      authUrl,
    );

    const cookieValue = result.setCookieHeader
      .split(';')[0]
      ?.replace(/^pending_login=/, '');

    if (!cookieValue) {
      return NextResponse.json(
        { error: 'Failed to build pending cookie' },
        { status: 500 },
      );
    }

    const response = NextResponse.redirect(
      new URL('/auth/email/confirm', request.url),
      303,
    );
    response.cookies.set('pending_login', cookieValue, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid token';
    return NextResponse.redirect(
      new URL(`/auth/email?error=${encodeURIComponent(message)}`, request.url),
      303,
    );
  }
}
