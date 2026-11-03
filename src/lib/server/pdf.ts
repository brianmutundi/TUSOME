import { NextResponse, type NextRequest } from 'next/server';
import { chromium } from 'playwright';
import { getSupabaseBrowserConfig } from '@/lib/supabase/client';
import { authenticate } from '@/lib/server/auth';

/**
 * Open an app page in headless Chromium as the verified caller and return it as a PDF.
 * The caller's token is placed in the browser's Supabase storage, so the page's own
 * RPC calls run under that user's row-level security, never a service role.
 */
export async function renderPagePdf(options: {
  request: NextRequest;
  path: string;
  filename: string;
}): Promise<NextResponse> {
  const caller = await authenticate(options.request);
  if (!caller) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const { url } = getSupabaseBrowserConfig();
  const ref = new URL(url).hostname.split('.')[0];
  const storageKey = `sb-${ref}-auth-token`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
    const page = await browser.newPage();
    await page.addInitScript(
      ([k, v]) => window.localStorage.setItem(k, v),
      [storageKey, JSON.stringify(caller.session)] as const
    );
    await page.goto(`${baseUrl}${options.path}`, { waitUntil: 'networkidle' });

    if (new URL(page.url()).pathname.startsWith('/login')) {
      return NextResponse.json({ error: 'Session was not accepted' }, { status: 401 });
    }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#6b7280;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      margin: { top: '20mm', right: '20mm', bottom: '24mm', left: '20mm' },
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${options.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
