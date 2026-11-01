import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

export async function GET(
  request: NextRequest,
  { params }: { params: { tripId: string; studentId: string } }
) {
  const { tripId, studentId } = params;

  if (!tripId || !studentId) {
    return NextResponse.json({ error: 'Trip ID and Student ID required' }, { status: 400 });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await page.goto(`${baseUrl}/analytics/trips/${tripId}/permission-slip/${studentId}`, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="permission-slip-${tripId}-${studentId}.pdf"`,
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
