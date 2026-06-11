import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeImageUrlForStorage } from '@/lib/image-url';
import { getTagsForWord } from '@/lib/tag-db';
import {
  formatWordSaveError,
  normalizeEntryTypeForStorage,
  normalizeLemmaForStorage,
  validateEntryTypeLemma,
  type EntryType,
} from '@/lib/word-entry';

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

    const tags = await getTagsForWord(id);
    return NextResponse.json({
      ...data,
      progress: progressObj,
      tags,
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
      'mnemonic', 'is_saved', 'entry_type', 'show_image',
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

    const { data: current, error: fetchError } = await supabase
      .from('words')
      .select('word, is_custom, entry_type')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Word not found' }, { status: 404 });
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if ('entry_type' in updates) {
      updates.entry_type = normalizeEntryTypeForStorage(
        updates.entry_type,
        typeof updates.word === 'string' ? updates.word : current.word
      );
    }

    if (typeof updates.word === 'string') {
      const normalized = normalizeLemmaForStorage(updates.word);
      const entryType = (
        'entry_type' in updates
          ? updates.entry_type
          : current.entry_type
      ) as EntryType | null;
      const validationError = validateEntryTypeLemma(
        entryType === 'expression' ? 'expression' : 'word',
        normalized
      );
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      updates.word = normalized;

      const { data: duplicates, error: dupError } = await supabase
        .from('words')
        .select('id, word')
        .ilike('word', normalized)
        .neq('id', id)
        .limit(1);

      if (dupError) {
        return NextResponse.json({ error: dupError.message }, { status: 500 });
      }

      const duplicate = duplicates?.[0];
      if (duplicate) {
        return NextResponse.json(
          {
            error: formatWordSaveError(
              'duplicate key value violates unique constraint',
              normalized,
              duplicate.word
            ),
          },
          { status: 409 }
        );
      }
    } else if ('entry_type' in updates && updates.entry_type === 'word') {
      const validationError = validateEntryTypeLemma(
        'word',
        String(current.word ?? '')
      );
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
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
      const msg = error.message ?? 'Update failed';
      const status = msg.toLowerCase().includes('duplicate') ? 409 : 500;
      return NextResponse.json(
        {
          error: formatWordSaveError(
            msg,
            typeof updates.word === 'string' ? updates.word : current.word,
            current.word
          ),
        },
        { status }
      );
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
