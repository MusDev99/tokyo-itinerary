import { useState } from 'preact/hooks';
import jsPDF from 'jspdf';
import type { DayItinerary } from '../types/itinerary';

interface Props {
  itinerary: DayItinerary[];
}

export default function PDFDownload({ itinerary }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (margin * 2);
      
      // Colors
      const primaryColor = '#1a202c';
      const accentColor = '#2a69ac';
      const textColor = '#4a5568';
      const lightTextColor = '#718096';
      const backgroundColor = '#f7fafc';

      let yPosition = 0;
      let pageNumber = 1;

      const drawHeader = () => {
        pdf.setFillColor(primaryColor);
        pdf.rect(0, 0, pageWidth, 30, 'F');
        
        pdf.setFontSize(22);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor('#ffffff');
        pdf.text('Tokyo 2025 Trip Itinerary', margin, 18);
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text('One week exploration in Autumn', pageWidth - margin, 18, { align: 'right' });
        
        yPosition = 40;
      };

      const drawFooter = () => {
        pdf.setFontSize(8);
        pdf.setTextColor(lightTextColor);
        pdf.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };

      const newPage = () => {
        pdf.addPage();
        pageNumber++;
        drawFooter();
        yPosition = margin;
      };

      // Start PDF Generation
      drawHeader();
      drawFooter();

      // Summary
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(primaryColor);
      pdf.text('Trip Summary', margin, yPosition);
      yPosition += 8;

      pdf.setFillColor('#e2e8f0');
      pdf.rect(margin, yPosition, contentWidth, 22, 'F');
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(textColor);
      pdf.text(`Total Days: ${itinerary.length}`, margin + 5, yPosition + 8);
      pdf.text(`Start Date: ${itinerary[0].date}`, margin + 70, yPosition + 8);
      pdf.text(`End Date: ${itinerary[itinerary.length - 1].date}`, margin + 130, yPosition + 8);
      yPosition += 30;

      // Itinerary Details
      itinerary.forEach((day) => {
        if (yPosition > pageHeight - 60) newPage();
        
        // Day Header
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(accentColor);
        pdf.text(`Day ${day.day}: ${day.title}`, margin, yPosition);
        yPosition += 6;
        pdf.setDrawColor(accentColor);
        pdf.line(margin, yPosition, margin + 50, yPosition);
        yPosition += 10;

        // Day Items
        day.items.forEach((item) => {
          if (yPosition > pageHeight - 40) newPage();

          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(primaryColor);
          pdf.text(`${item.time} - ${item.title}`, margin, yPosition);
          yPosition += 6;

          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(textColor);
          const descriptionLines = pdf.splitTextToSize(item.description, contentWidth);
          pdf.text(descriptionLines, margin, yPosition);
          yPosition += (descriptionLines.length * 4) + 2;

          // Location
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(lightTextColor);
          pdf.text(`📍 ${item.location.name}`, margin, yPosition);
          yPosition += 6;

          // Price
          if (item.price.amount > 0) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(textColor);
            const priceNote = item.price.notes || '';
            pdf.text(`💰 ${item.price.amount} ${item.price.currency}${priceNote ? ` (${priceNote})` : ''}`, margin, yPosition);
            yPosition += 6;
          }

          // Note
          if (item.note) {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(lightTextColor);
            const noteLines = pdf.splitTextToSize(`📝 ${item.note}`, contentWidth);
            pdf.text(noteLines, margin, yPosition);
            yPosition += (noteLines.length * 3.5) + 2;
          }
          
          yPosition += 8;
        });
        yPosition += 5;
      });

      // Total Cost
      const totalCost = itinerary.reduce((total, day) => 
        total + day.items.reduce((dayTotal, item) => dayTotal + item.price.amount, 0), 0);

      if (yPosition > pageHeight - 40) newPage();

      pdf.setFillColor('#e2e8f0');
      pdf.rect(margin, yPosition, contentWidth, 20, 'F');
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(primaryColor);
      pdf.text('Total Estimated Cost:', margin + 5, yPosition + 12);
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(accentColor);
      pdf.text(`JPY ${totalCost.toLocaleString()}`, pageWidth - margin - 5, yPosition + 12, { align: 'right' });

      // Save PDF
      pdf.save('tokyo-itinerary-2025.pdf');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating the PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex justify-center my-8">
      <button
        onClick={generatePDF}
        disabled={isGenerating}
        className={`relative px-8 py-3 text-base font-semibold rounded-full transition-all duration-300 overflow-hidden group touch-target focus-ring
          ${isGenerating 
            ? 'bg-gray-400 text-white cursor-not-allowed' 
            : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 active:scale-95 shadow-lg hover:shadow-2xl transform hover:-translate-y-1'
          }`}
      >
        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-600/50">
            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        
        <span className="relative z-10 flex items-center gap-3">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM5.05 8.95a.75.75 0 011.06 0L10 12.84l3.89-3.89a.75.75 0 111.06 1.06l-4.42 4.42a.75.75 0 01-1.06 0L5.05 10.01a.75.75 0 010-1.06z" clipRule="evenodd" fillRule="evenodd" />
          </svg>
          {isGenerating ? 'Generating...' : 'Download PDF Itinerary'}
        </span>
      </button>
    </div>
  );
}
 