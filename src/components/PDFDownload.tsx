import { useState } from 'preact/hooks';
import { toast } from '../utils/toast';
import type { DayItinerary } from '../types/itinerary';
import { buildPdfModel, pdfFileName } from '../utils/tripPdf';
import Button from './ui/Button';

// jspdf (~400 KB with its deps) and the drawing code load when the person asks for a PDF, not with the page
const loadPdf = () => Promise.all([import('jspdf').then((m) => m.default), import('../utils/pdfRender')]);

interface Props {
  itinerary: DayItinerary[];
  /** Trip title printed on the cover and used for the file name */
  title: string;
  /** e.g. "Tokyo → Osaka · Japan" (default: the cities of the days) */
  subtitle?: string;
  /** Path of the trip page ("/trips/japan-2025"), printed in the footer as a link */
  href?: string;
  /** For prices that carry no currency of their own */
  currency?: string;
}

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/**
 * Downloads the trip as a branded PDF: cover with the PlanTravel logo, the days at a glance, what it costs, then each
 * day as a timeline with map links and tips. Japanese place names need a font: it is fetched from our own server only
 * when the trip has such text (about 1 MB), never for Latin-only trips.
 */
export default function PDFDownload({ itinerary, title, subtitle, href, currency }: Props) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const [JsPdf, { renderTripPdf }] = await loadPdf();
      const model = buildPdfModel(
        { title, subtitle, url: href ? `${location.origin}${href}` : undefined, currency },
        itinerary
      );

      // Optional assets: a failure here never blocks the PDF
      const [logo, cjkFont] = await Promise.all([
        fetch('/logo-pdf.png').then((r) => (r.ok ? r.blob() : Promise.reject())).then(toDataUrl).catch(() => undefined),
        model.needsCjk
          ? fetch('/fonts/NotoSansJP-subset.ttf').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).catch(() => undefined)
          : Promise.resolve(undefined),
      ]);
      if (model.needsCjk && !cjkFont) toast.info('The Japanese font could not be loaded, so Japanese text was left out of the PDF.');

      const pdf = renderTripPdf(JsPdf, model, { logo, cjkFont });
      pdf.save(pdfFileName(title));
      toast.success('PDF ready');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Could not create the PDF. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex justify-center w-full sm:w-auto">
      <Button
        size="lg"
        className="w-full sm:w-auto rounded-full"
        onClick={generate}
        // Warm the chunks on intent (hover / focus / touch) so the tap itself feels immediate
        onPointerEnter={() => void loadPdf()}
        onFocus={() => void loadPdf()}
        busy={busy}
        busyLabel="Preparing your PDF…"
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" />
        </svg>
        Download PDF itinerary
      </Button>
    </div>
  );
}
