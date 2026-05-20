/**
 * CoCA 60,000 Word List Import Script
 * 
 * Usage:
 *   1. Download the CoCA spreadsheet from the source
 *   2. Save/export as CSV
 *   3. Run: npx tsx scripts/import-coca.ts <path-to-csv>
 * 
 * Expected CSV columns (flexible matching):
 *   Rank, Word, PoS (Part of Speech), Frequency, Dispersion
 * 
 * The script will parse the CSV and POST to /api/import in batches.
 */

import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3000';

interface CocaRow {
  rank: number;
  word: string;
  part_of_speech: string;
  frequency?: number;
  dispersion?: number;
}

function parseCSV(content: string): CocaRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file appears empty or has no data rows');
  }

  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));

  const rankIdx = headers.findIndex(h => h.includes('rank') || h === '#');
  const wordIdx = headers.findIndex(h => h.includes('word') || h === 'lemma');
  const posIdx = headers.findIndex(h => h.includes('pos') || h.includes('part'));
  const freqIdx = headers.findIndex(h => h.includes('freq') || h.includes('count'));

  if (wordIdx === -1) {
    throw new Error('Could not find "word" column in CSV. Headers: ' + headers.join(', '));
  }

  const rows: CocaRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    const word = cols[wordIdx]?.trim();
    if (!word) continue;

    rows.push({
      rank: rankIdx !== -1 ? parseInt(cols[rankIdx]) || i : i,
      word: word.toLowerCase(),
      part_of_speech: posIdx !== -1 ? (cols[posIdx] || '').toLowerCase() : '',
      frequency: freqIdx !== -1 ? parseInt(cols[freqIdx]) || undefined : undefined,
    });
  }

  return rows;
}

function categorizeWord(pos: string, rank: number): string {
  if (rank <= 3000) return 'daily conversation';
  if (pos === 'n' || pos === 'noun') return 'academic';
  if (pos === 'v' || pos === 'verb') return 'academic';
  if (pos === 'j' || pos === 'adj' || pos === 'adjective') return 'academic';
  if (rank <= 10000) return 'academic';
  return 'academic';
}

async function importWords(rows: CocaRow[]) {
  const words = rows.map(row => ({
    word: row.word,
    definition: '',
    translation_zh: '',
    ipa: '',
    rank: row.rank,
    part_of_speech: row.part_of_speech,
    category: categorizeWord(row.part_of_speech, row.rank),
    is_custom: false,
    example_sentences: [],
    synonyms: [],
    antonyms: [],
    collocations: [],
  }));

  const BATCH_SIZE = 1000;
  let totalImported = 0;

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE);
    console.log(`Importing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(words.length / BATCH_SIZE)} (${batch.length} words)...`);

    try {
      const res = await fetch(`${API_URL}/api/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: batch }),
      });

      const result = await res.json();
      if (result.success) {
        totalImported += result.imported;
        console.log(`  Imported: ${result.imported}, Errors: ${result.errors}`);
      } else {
        console.error(`  Error:`, result.error);
      }
    } catch (err) {
      console.error(`  Failed to send batch:`, err);
    }
  }

  console.log(`\nDone! Total imported: ${totalImported}/${words.length}`);
}

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.log('Usage: npx tsx scripts/import-coca.ts <path-to-csv>');
    console.log('\nYou can also import via the Settings page in the app.');
    process.exit(1);
  }

  const fullPath = path.resolve(csvPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    process.exit(1);
  }

  console.log(`Reading ${fullPath}...`);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`Parsed ${rows.length} words from CSV`);

  if (rows.length > 0) {
    console.log(`Sample: ${JSON.stringify(rows[0])}`);
  }

  await importWords(rows);
}

main().catch(console.error);
