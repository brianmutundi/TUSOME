import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

export async function GET(
  request: NextRequest,
  { params }: { params: { receiptId: string } }
) {
  const receiptId = params.receiptId;

  if (!receiptId) {
    return NextResponse.json({ error: 'Receipt ID required' }, { status: 400 });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Navigate to the receipt page
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/analytics/receipts/${receiptId}`, { waitUntil: 'networkidle' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${receiptId}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
