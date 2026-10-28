import type { APIRoute } from 'astro';
import { tripCalendarResponse } from '../../utils/tripCalendar';

/** Public, read-only iCalendar feed of a whole country (every state merged; subscribe or ?download). */
export const GET: APIRoute = ({ params, request }) => tripCalendarResponse(request, params.country);
