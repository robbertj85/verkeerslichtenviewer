import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Read the summary file
    const summaryPath = path.join(process.cwd(), 'public', 'data', 'summary.json');
    const fileContent = await fs.readFile(summaryPath, 'utf-8');
    const summary = JSON.parse(fileContent);

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
