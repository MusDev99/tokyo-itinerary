import type { APIRoute } from 'astro';
import { tripCalendarResponse } from '../../../utils/tripCalendar';

/** Public, read-only iCalendar feed of one trip (subscribe or ?download). */
export const GET: APIRoute = ({ params, request }) => tripCalendarResponse(request, params.country, params.state);
