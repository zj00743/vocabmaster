import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { DailyStats } from '@/lib/types';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      reviewedTodayResult,
      dueTodayResult,
      newTodayResult,
      totalLearnedResult,
      recentReviewsResult,
      allReviewDatesResult,
    ] = await Promise.all([
      supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .gte('reviewed_at', todayStart)
        .lt('reviewed_at', todayEnd),

      supabase
        .from('learning_progress')
        .select('*', { count: 'exact', head: true })
        .lte('next_review', now.toISOString()),

      supabase
        .from('learning_progress')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd),

      supabase
        .from('learning_progress')
        .select('*', { count: 'exact', head: true })
        .in('status', ['review', 'mastered']),

      supabase
        .from('reviews')
        .select('rating')
        .gte('reviewed_at', thirtyDaysAgo),

      supabase
        .from('reviews')
        .select('reviewed_at')
        .order('reviewed_at', { ascending: false })
        .limit(365),
    ]);

    const recentReviews = recentReviewsResult.data ?? [];
    let retentionRate = 0;
    if (recentReviews.length > 0) {
      const goodOrEasy = recentReviews.filter(
        (r) => r.rating === 3 || r.rating === 4
      ).length;
      retentionRate = Math.round((goodOrEasy / recentReviews.length) * 100);
    }

    let streak = 0;
    const reviewDates = allReviewDatesResult.data ?? [];
    if (reviewDates.length > 0) {
      const uniqueDays = new Set(
        reviewDates.map((r) => {
          const d = new Date(r.reviewed_at);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        })
      );

      const checkDate = new Date(now);
      const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;

      if (!uniqueDays.has(todayKey)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      while (true) {
        const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
        if (uniqueDays.has(key)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const stats: DailyStats = {
      reviewed_today: reviewedTodayResult.count ?? 0,
      due_today: dueTodayResult.count ?? 0,
      new_today: newTodayResult.count ?? 0,
      streak,
      retention_rate: retentionRate,
      total_learned: totalLearnedResult.count ?? 0,
    };

    return NextResponse.json(stats);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
