import { NextResponse } from 'next/server';
import { introspectToken } from '#example-nextjs-ssr/lib/oidc-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, token_type_hint } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const result = await introspectToken(token, token_type_hint);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Introspection error:', error);
    return NextResponse.json(
      { error: 'Introspection failed' },
      { status: 500 },
    );
  }
}
