import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function DELETE() {
  try {
    const { error: reviewsError } = await supabase
      .from('reviews')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (reviewsError) {
      return NextResponse.json({ error: reviewsError.message }, { status: 500 });
    }

    const { error } = await supabase
      .from('learning_progress')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    /* "Reset all progress" should also clear user-set exclusions — the user
       expects a fully clean slate. Failures here are non-fatal. */
    const { error: clearExcludedError } = await supabase
      .from('excluded_from_review')
      .delete()
      .neq('word_id', '00000000-0000-0000-0000-000000000000');
    if (clearExcludedError) {
      console.error(
        '[progress] failed to clear excluded_from_review on reset:',
        clearExcludedError
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word_id } = body;

    if (!word_id) {
      return NextResponse.json(
        { error: 'Field "word_id" is required' },
        { status: 400 }
      );
    }

    const { data: wordExists } = await supabase
      .from('words')
      .select('id')
      .eq('id', word_id)
      .single();

    if (!wordExists) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from('learning_progress')
      .select('id')
      .eq('word_id', word_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Progress already exists for this word' },
        { status: 409 }
      );
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('learning_progress')
      .insert({
        word_id,
        status: 'new',
        difficulty: 5.0,
        stability: 0.4,
        next_review: tomorrow.toISOString(),
        last_reviewed: null,
        review_count: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    /* If the user had previously removed this word, re-adding clears the
       exclusion so it's eligible for the new-card filler again. */
    const { error: clearExcludeError } = await supabase
      .from('excluded_from_review')
      .delete()
      .eq('word_id', word_id);
    if (clearExcludeError) {
      console.error(
        '[progress] failed to clear excluded_from_review row:',
        clearExcludeError
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
