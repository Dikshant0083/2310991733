import { NextRequest, NextResponse } from 'next/server';

const backendApiBase =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000/api/v1';
const defaultStudentId = process.env.NEXT_PUBLIC_STUDENT_ID || '1042';

const emptyStatsPayload = (source: string, fallbackReason?: string) => ({
  success: true,
  data: {
    unreadCount: 0,
    unreadByType: {
      placement: 0,
      event: 0,
      result: 0,
    },
  },
  meta: {
    timestamp: new Date().toISOString(),
    source,
    fallbackReason,
  },
});

const toJsonBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return null;
};

export async function GET(request: NextRequest) {
  const backendUrl = new URL(`${backendApiBase.replace(/\/$/, '')}/notifications/stats`);
  const studentId = request.headers.get('x-student-id') || defaultStudentId;
  const studentRole = request.headers.get('x-student-role') || 'student';

  try {
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Student-ID': studentId,
        'X-Student-Role': studentRole,
      },
      cache: 'no-store',
    });

    const body = await toJsonBody(backendResponse);
    if (backendResponse.ok && body) {
      const nextResponse = NextResponse.json(body, {
        status: backendResponse.status,
      });
      nextResponse.headers.set('X-Notifications-Source', 'backend');
      return nextResponse;
    }

    const nextResponse = NextResponse.json(
      emptyStatsPayload('stats-fallback', `Backend responded with ${backendResponse.status}`),
      { status: 200 }
    );
    nextResponse.headers.set('X-Notifications-Source', 'stats-fallback');
    return nextResponse;
  } catch (error) {
    const nextResponse = NextResponse.json(
      emptyStatsPayload(
        'stats-fallback',
        error instanceof Error ? error.message : 'Backend stats unavailable'
      ),
      { status: 200 }
    );
    nextResponse.headers.set('X-Notifications-Source', 'stats-fallback');
    return nextResponse;
  }
}
