import { useCallback } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const SYSTEM_PROMPT = `You are an AI assistant for IGNIS - an emergency incident command logging system.
Your task is to analyze a voice transcription from an Incident Commander and produce a concise, structured operational summary.

Rules:
- Produce a single-line headline (max 80 characters) capturing the KEY ACTION or DIRECTIVE
- Use clear operational language (e.g., "Establish perimeter at Sector A", "Dispatch unit to stairwell B")
- Focus on WHO, WHAT, WHERE if present
- If the transcription is unclear or too short, respond with "Verbal directive logged — review transcription"
- Return ONLY the summary headline, nothing else`;

export function useLLMSummarize() {
  const summarize = useCallback(async (transcription: string): Promise<string> => {
    if (!transcription.trim()) {
      return 'No transcription — entry logged manually';
    }

    try {
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nTranscription:\n"${transcription}"\n\nSummary:`,
            },
          ],
        },
      ];

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/large-language-model`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ contents }),
          signal: AbortSignal.timeout(30_000),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error(`LLM request failed: ${response.status}`);
      }

      // Read SSE stream and collect full text
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const frame = JSON.parse(dataStr);
            const text = frame?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) fullText += text;
          } catch {
            // incomplete frame, skip
          }
        }
      }

      const cleaned = fullText.trim().replace(/^["']|["']$/g, '');
      return cleaned || 'Directive logged — review transcription';
    } catch (err) {
      console.error('LLM summarize error:', err);
      return 'Summary unavailable — review transcription';
    }
  }, []);

  return { summarize };
}
