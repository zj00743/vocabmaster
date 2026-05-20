import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeImageUrlForStorage } from '@/lib/image-url';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabase
      .from('words')
      .select(`
        *,
        progress:learning_progress(*)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Word not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawProg = (
      data as unknown as Record<string, unknown>
    ).progress as unknown;
    const progressObj = Array.isArray(rawProg) ? rawProg[0] ?? null : rawProg ?? null;

    return NextResponse.json({
      ...data,
      progress: progressObj,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowedFields = [
      'word', 'definition', 'translation_zh', 'ipa', 'part_of_speech',
      'example_sentences', 'synonyms', 'antonyms', 'collocations',
      'common_expressions',
      'mnemonic', 'category', 'is_saved',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field === 'image_url') continue;
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if ('image_url' in body) {
      const img = normalizeImageUrlForStorage(body.image_url);
      if (!img.ok) {
        return NextResponse.json({ error: img.error }, { status: 400 });
      }
      updates.image_url = img.value;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('words')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Word not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: word, error: fetchError } = await supabase
      .from('words')
      .select('is_custom')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Word not found' }, { status: 404 });
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!word.is_custom) {
      return NextResponse.json(
        { error: 'Only custom words can be deleted' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('words')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
