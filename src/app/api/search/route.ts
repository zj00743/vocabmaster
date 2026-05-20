import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('words')
      .select(`
        *,
        progress:learning_progress(*)
      `)
      .ilike('word', `%${q.trim()}%`)
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    /* PostgREST returns the embed as an OBJECT when the FK column is uniquely
       indexed (we have UNIQUE(word_id) on learning_progress), and as an ARRAY
       otherwise. Handle both so saved words always surface their progress. */
    const results = (data ?? []).map((item) => {
      const raw = (item as Record<string, unknown>).progress;
      const progress = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
      return { ...item, progress };
    });

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
