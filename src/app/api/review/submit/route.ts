import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scheduleFSRS } from '@/lib/fsrs';
import { LearningProgress, Rating } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { word_id, rating, response_time } = body;

    if (!word_id || !rating || ![1, 2, 3, 4].includes(rating)) {
      return NextResponse.json(
        { error: 'Valid word_id and rating (1-4) are required' },
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

    const { data: currentProgress } = await supabase
      .from('learning_progress')
      .select('*')
      .eq('word_id', word_id)
      .single();

    const scheduled = scheduleFSRS(
      currentProgress as LearningProgress | null,
      rating as Rating
    );

    let updatedProgress;

    if (currentProgress) {
      const { data, error } = await supabase
        .from('learning_progress')
        .update({
          status: scheduled.status,
          difficulty: scheduled.difficulty,
          stability: scheduled.stability,
          next_review: scheduled.next_review,
          last_reviewed: scheduled.last_reviewed,
          review_count: scheduled.review_count,
        })
        .eq('word_id', word_id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedProgress = data;
    } else {
      const { data, error } = await supabase
        .from('learning_progress')
        .insert({
          word_id,
          status: scheduled.status,
          difficulty: scheduled.difficulty,
          stability: scheduled.stability,
          next_review: scheduled.next_review,
          last_reviewed: scheduled.last_reviewed,
          review_count: scheduled.review_count,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updatedProgress = data;
    }

    const { error: reviewError } = await supabase
      .from('reviews')
      .insert({
        word_id,
        rating,
        response_time: response_time ?? null,
        reviewed_at: new Date().toISOString(),
      });

    if (reviewError) {
      return NextResponse.json({ error: reviewError.message }, { status: 500 });
    }

    return NextResponse.json(updatedProgress);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
