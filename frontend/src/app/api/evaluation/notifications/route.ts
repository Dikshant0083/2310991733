import { NextRequest, NextResponse } from 'next/server';

const evaluationEndpoint =
  process.env.NOTIFICATION_FEED_URL ||
  'http://20.207.122.201/evaluation-service/notifications';
const backendApiBase =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000/api/v1';
const defaultStudentId = process.env.NEXT_PUBLIC_STUDENT_ID || '1042';

const createBackendNotificationsUrl = (request: NextRequest) => {
  const baseUrl = backendApiBase.replace(/\/$/, '');
  const backendUrl = new URL(`${baseUrl}/notifications`);

  const page = request.nextUrl.searchParams.get('page');
  const limit = request.nextUrl.searchParams.get('limit');
  const notificationType = request.nextUrl.searchParams.get('notification_type');
  const status = request.nextUrl.searchParams.get('status');

  if (page) {
    backendUrl.searchParams.set('page', page);
  }

  if (limit) {
    backendUrl.searchParams.set('limit', limit);
  }

  if (notificationType) {
    backendUrl.searchParams.set('type', notificationType);
  }

  if (status) {
    backendUrl.searchParams.set('status', status);
  }

  return backendUrl;
};

const toJsonBody = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return {
    success: false,
    error: {
      code: 'NON_JSON_RESPONSE',
      message: await response.text(),
    },
  };
};

const fetchBackendFallback = async (request: NextRequest, upstreamStatus?: number) => {
  const backendUrl = createBackendNotificationsUrl(request);
  const studentId = request.headers.get('x-student-id') || defaultStudentId;
  const studentRole = request.headers.get('x-student-role') || 'student';

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
  const nextResponse = NextResponse.json(body, {
    status: backendResponse.status,
  });

  nextResponse.headers.set('X-Notifications-Source', 'backend-fallback');
  if (upstreamStatus) {
    nextResponse.headers.set('X-Evaluation-Upstream-Status', String(upstreamStatus));
  }

  return nextResponse;
};

export async function GET(request: NextRequest) {
  try {
    const upstreamUrl = new URL(evaluationEndpoint);

    request.nextUrl.searchParams.forEach((value, key) => {
      upstreamUrl.searchParams.set(key, value);
    });

    const upstreamResponse = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!upstreamResponse.ok) {
      return fetchBackendFallback(request, upstreamResponse.status);
    }

    const body = await toJsonBody(upstreamResponse);

    const nextResponse = NextResponse.json(body, {
      status: upstreamResponse.status,
    });

    nextResponse.headers.set('X-Notifications-Source', 'evaluation-feed');
    return nextResponse;
  } catch (error) {
    try {
      return await fetchBackendFallback(request);
    } catch (fallbackError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EVALUATION_FEED_UNAVAILABLE',
            message:
              fallbackError instanceof Error
                ? fallbackError.message
                : error instanceof Error
                  ? error.message
                  : 'Failed to reach evaluation notification service',
          },
        },
        { status: 502 }
      );
    }
  }
}
