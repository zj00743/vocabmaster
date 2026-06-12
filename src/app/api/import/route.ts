import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeEntryTypeForStorage } from '@/lib/word-entry';

export async function POST(request: NextRequest) {
  try {
    const { words } = await request.json();

    if (!Array.isArray(words) || words.length === 0) {
      return NextResponse.json(
        { error: 'No words provided. Expected { words: [...] }' },
        { status: 400 }
      );
    }

    const BATCH_SIZE = 500;
    let imported = 0;
    let errors = 0;
    let lastError: string | null = null;

    for (let i = 0; i < words.length; i += BATCH_SIZE) {
      const batch = words.slice(i, i + BATCH_SIZE).map((w: Record<string, unknown>) => ({
        word: String(w.word || '').trim(),
        entry_type: normalizeEntryTypeForStorage(null, String(w.word || '')),
        definition: String(w.definition || ''),
        translation_zh: String(w.translation_zh || ''),
        ipa: String(w.ipa || ''),
        pronunciation_url: w.pronunciation_url || null,
        rank: w.rank ? Number(w.rank) : null,
        part_of_speech: String(w.part_of_speech || ''),
        word_family: w.word_family ? String(w.word_family) : null,
        example_sentences: Array.isArray(w.example_sentences) ? w.example_sentences : [],
        synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
        antonyms: Array.isArray(w.antonyms) ? w.antonyms : [],
        collocations: Array.isArray(w.collocations) ? w.collocations : [],
        image_url: w.image_url || null,
        image_prompt: w.image_prompt || null,
        mnemonic: w.mnemonic || null,
        is_custom: Boolean(w.is_custom),
      }));

      const { error } = await supabase
        .from('words')
        .upsert(batch, { onConflict: 'word', ignoreDuplicates: true });

      if (error) {
        console.error(`Batch import error at offset ${i}:`, error);
        lastError = error.message;
        errors += batch.length;
      } else {
        imported += batch.length;
      }
    }

    return NextResponse.json({
      success: imported > 0,
      imported,
      errors,
      total: words.length,
      lastError,
      hint:
        imported === 0 && errors > 0
          ? 'If the error mentions ON CONFLICT or unique constraint, run supabase-migration-words-unique.sql in Supabase SQL Editor, then import again.'
          : undefined,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import words' },
      { status: 500 }
    );
  }
}
