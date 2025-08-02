import { h } from 'preact';
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
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      let yPosition = margin;
      
      // Title
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Tokyo 2025 Trip Itinerary', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;
      
      // Subtitle
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('One week exploration to Tokyo Japan & Fuji in Autumn Season', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 20;
      
      // Summary
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Trip Summary:', margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`• Total Days: ${itinerary.length}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`• Start Date: ${itinerary[0].date}`, margin, yPosition);
      yPosition += 6;
      pdf.text(`• End Date: ${itinerary[itinerary.length - 1].date}`, margin, yPosition);
      yPosition += 15;
      
      // Iterate through each day
      itinerary.forEach((day, dayIndex) => {
        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = margin;
        }
        
        // Day header
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Day ${day.day}: ${day.title}`, margin, yPosition);
        yPosition += 8;
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Date: ${day.date}`, margin, yPosition);
        yPosition += 12;
        
        // Day items
        day.items.forEach((item, itemIndex) => {
          // Check if we need a new page
          if (yPosition > pageHeight - 40) {
            pdf.addPage();
            yPosition = margin;
          }
          
          // Time and title
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${item.time} - ${item.title}`, margin, yPosition);
          yPosition += 6;
          
          // Description
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          const descriptionLines = pdf.splitTextToSize(item.description, contentWidth);
          pdf.text(descriptionLines, margin, yPosition);
          yPosition += (descriptionLines.length * 4);
          
          // Location
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.text(`${item.location.name}`, margin, yPosition);
          yPosition += 5;
          
          // Price
          if (item.price.amount > 0) {
            pdf.setFontSize(9);
            pdf.setFont('helvetica', 'normal');
            const priceNote = item.price.notes || '';
            pdf.text(`${item.price.amount} ${item.price.currency}${priceNote ? ` - ${priceNote}` : ''}`, margin, yPosition);
            yPosition += 5;
          }
          
          // Note
          if (item.note) {
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'italic');
            pdf.text(`${item.note}`, margin, yPosition);
            yPosition += 5;
          }
          
          yPosition += 8; // Space between items
        });
        
        yPosition += 10; // Space between days
      });
      
      // Add total cost calculation
      const totalCost = itinerary.reduce((total, day) => {
        return total + day.items.reduce((dayTotal, item) => {
          return dayTotal + item.price.amount;
        }, 0);
      }, 0);
      
      if (yPosition > pageHeight - 40) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Total Estimated Cost:', margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`JPY ${totalCost.toLocaleString()}`, margin, yPosition);
      
      // Save the PDF
      pdf.save('tokyo-itinerary-2025.pdf');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex justify-center mb-4">
      <button
        onClick={generatePDF}
        disabled={isGenerating}
        className={`px-6 py-3 text-sm font-medium rounded-lg transition-colors
          ${isGenerating 
            ? 'bg-gray-400 text-white cursor-not-allowed' 
            : 'bg-primary text-white hover:bg-primary/90 active:bg-primary/80'
          }`}
      >
        {isGenerating ? 'Generating PDF...' : '📄 Download PDF Itinerary'}
      </button>
    </div>
  );
} 