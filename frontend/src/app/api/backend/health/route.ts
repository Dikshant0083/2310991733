import { NextResponse } from 'next/server';

const backendApiBase =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000/api/v1';
const backendOrigin = backendApiBase.replace(/\/api\/v1\/?$/, '');
const healthEndpoint = `${backendOrigin}/health`;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Backend health check failed';

export async function GET() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(healthEndpoint, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });

    return NextResponse.json({
      available: response.ok,
      status: response.status,
      url: healthEndpoint,
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      status: 503,
      url: healthEndpoint,
      error: getErrorMessage(error),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
