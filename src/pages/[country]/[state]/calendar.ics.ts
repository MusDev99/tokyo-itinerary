import type { APIRoute } from 'astro';
import { tripCalendarResponse } from '../../../utils/tripCalendar';

/** Old feed address, kept serving (not redirected) because calendar apps subscribe to it. */
export const GET: APIRoute = ({ params, request }) =>
  tripCalendarResponse(request, { countrySlug: params.country, stateSlug: params.state });
