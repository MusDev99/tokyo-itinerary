import type { APIRoute } from 'astro';
import { SESSION_COOKIE, isSameOrigin } from '../../utils/auth';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!isSameOrigin(request)) return new Response('Cross-site request blocked.', { status: 403 });
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/login', 303);
};
