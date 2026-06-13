import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeImageUrlForStorage } from '@/lib/image-url';
import { getTagsForWord } from '@/lib/tag-db';
import {
  formatWordSaveError,
  lemmasEqualForStorage,
  normalizeEntryTypeForStorage,
  normalizeLemmaForStorage,
  validateEntryTypeLemma,
  type EntryType,
} from '@/lib/word-entry';

async function findConflictingWordRow(
  lemma: string,
  excludeId: string
): Promise<{ id: string; word: string } | undefined> {
  const { data, error } = await supabase
    .from('words')
    .select('id, word')
    .eq('word', lemma);

  if (error) throw error;
  return (data ?? []).find((row) => row.id !== excludeId);
}

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
      'hide_dictionary_definition',
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

    if (!current.is_custom && 'word' in updates) {
      delete updates.word;
    }

    if ('definition' in updates) {
      const def =
        typeof updates.definition === 'string' ? updates.definition.trim() : '';
      updates.definition = def;
      updates.hide_dictionary_definition = def === '';
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

      // Exact match only — client omits case-only autocorrect; intentional renames include `word`.
      if (lemmasEqualForStorage(normalized, String(current.word ?? ''))) {
        delete updates.word;
      } else {
        try {
          const duplicate = await findConflictingWordRow(normalized, id);
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
        } catch (dupError) {
          const msg =
            dupError instanceof Error ? dupError.message : 'Duplicate check failed';
          return NextResponse.json({ error: msg }, { status: 500 });
        }
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
      const msg = error.message ?? 'Update failed';
      const isDuplicate =
        msg.toLowerCase().includes('duplicate') ||
        msg.toLowerCase().includes('unique');
      if (isDuplicate && typeof updates.word !== 'string') {
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
      }
      const status = isDuplicate ? 409 : 500;
      let conflictingLemma: string | undefined;
      if (isDuplicate && typeof updates.word === 'string') {
        try {
          const conflictRow = await findConflictingWordRow(
            String(updates.word),
            id
          );
          conflictingLemma = conflictRow?.word;
        } catch {
          conflictingLemma = undefined;
        }
      }
      return NextResponse.json(
        {
          error: formatWordSaveError(
            msg,
            typeof updates.word === 'string' ? updates.word : current.word,
            conflictingLemma
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
