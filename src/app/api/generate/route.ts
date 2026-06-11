import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/** Lazy init so `next build` does not require OPENAI_API_KEY at compile time. */
function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

function openAiErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { status?: number; message?: string; code?: string };
  if (e.status === 401) {
    return "OpenAI API key is invalid. Check OPENAI_API_KEY in .env.local.";
  }
  if (e.status === 429) {
    return "OpenAI quota exceeded. Add billing or credits at platform.openai.com, then try again.";
  }
  if (typeof e.message === "string" && e.message.trim()) {
    return e.message;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        {
          error:
            "OPENAI_API_KEY is not set. Add it to .env.local to generate cards for words outside the dictionary.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { word } = body;

    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return NextResponse.json(
        { error: 'Field "word" is required' },
        { status: 400 }
      );
    }

    const lemma = word.trim();
    const isExpression = /\s/.test(lemma);
    const term = isExpression ? "expression" : "word";

    const prompt = `Generate a comprehensive vocabulary card for the English ${term} "${lemma}".

The card MUST describe the entire ${term} "${lemma}" as a whole${
      isExpression
        ? " (an idiom / multi-word expression), NOT just its individual words"
        : ""
    }.

Return a JSON object with these exact fields:
- "word": the ${term} itself
- "definition": clear English definition of the whole ${term}
- "translation_zh": Chinese translation of the whole ${term}
- "ipa": IPA pronunciation${isExpression ? ' (use "" for expressions)' : ""}
- "part_of_speech": e.g. "noun", "verb", "adjective"${
      isExpression ? ' (or "expression" / "idiom")' : ""
    }
- "category": one of: academic, business, science, medicine, art, technology, daily conversation, law, politics, sports, music, food, travel, education, nature
- "example_sentences": array of 3 example sentences using the whole ${term}
- "synonyms": array of 5-12 common synonyms of the whole ${term} (single words or short phrases)
- "antonyms": array of opposites of the whole ${term} where natural (may be empty when there is no crisp opposite)
- "collocations": array of 4-8 typical phrases or patterns using this ${term}
- "mnemonic": a creative memory aid or mnemonic device for the whole ${term}
- "image_prompt": a descriptive prompt to generate an illustration for this ${term}

Respond ONLY with valid JSON, no markdown or extra text.`;

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a vocabulary teaching assistant. Always respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to generate vocabulary card' },
        { status: 500 }
      );
    }

    const card = JSON.parse(content);

    return NextResponse.json(card);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }
    const detail = openAiErrorMessage(error);
    if (detail) {
      const status =
        error &&
        typeof error === "object" &&
        "status" in error &&
        typeof (error as { status: number }).status === "number"
          ? (error as { status: number }).status
          : 502;
      return NextResponse.json({ error: detail }, { status });
    }
    console.error("[generate]", error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
