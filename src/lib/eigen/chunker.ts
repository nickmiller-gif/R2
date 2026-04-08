/**
 * Recursive text chunker for the Eigen knowledge pipeline.
 *
 * Splits text into chunks of a target token size with configurable overlap.
 * Uses a hierarchy of separators (paragraph → sentence → word → character)
 * to find natural break points, similar to LangChain's RecursiveCharacterTextSplitter.
 *
 * Token estimation: 1 token ≈ 4 characters (conservative for English text).
 */

export interface ChunkOptions {
  /** Target chunk size in tokens. Default: 384. */
  maxTokens?: number;
  /** Overlap between consecutive chunks in tokens. Default: 10% of maxTokens. */
  overlapTokens?: number;
  /** Separators to try in order. Default: paragraph → sentence → word. */
  separators?: string[];
}

export interface TextChunk {
  /** The chunk text content. */
  content: string;
  /** Zero-based index of this chunk in the sequence. */
  index: number;
  /** Character offset in the original text where this chunk starts. */
  startOffset: number;
  /** Character offset in the original text where this chunk ends. */
  endOffset: number;
}

const DEFAULT_SEPARATORS = [
  '\n\n',   // Paragraph break
  '\n',     // Line break
  '. ',     // Sentence end
  '? ',     // Question end
  '! ',     // Exclamation end
  '; ',     // Semicolon
  ', ',     // Comma
  ' ',      // Word boundary
];

const CHARS_PER_TOKEN = 4;

function tokensToChars(tokens: number): number {
  return tokens * CHARS_PER_TOKEN;
}

/**
 * Split text into chunks using recursive character splitting.
 *
 * Tries each separator in order, splitting the text and merging segments
 * until they fit within the target chunk size. Falls back to character-level
 * splitting only as a last resort.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxTokens = options.maxTokens ?? 384;
  const overlapTokens = options.overlapTokens ?? Math.floor(maxTokens * 0.1);
  const separators = options.separators ?? DEFAULT_SEPARATORS;

  const maxChars = tokensToChars(maxTokens);
  const overlapChars = tokensToChars(overlapTokens);

  if (text.length <= maxChars) {
    return [{ content: text, index: 0, startOffset: 0, endOffset: text.length }];
  }

  const rawChunks = splitRecursive(text, separators, maxChars);
  return mergeWithOverlap(rawChunks, text, maxChars, overlapChars);
}

/**
 * Recursively split text using the separator hierarchy.
 */
function splitRecursive(text: string, separators: string[], maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  // Find the first separator that exists in the text
  for (const sep of separators) {
    const parts = text.split(sep);
    if (parts.length <= 1) continue;

    // Merge small consecutive segments until they approach maxChars
    const merged: string[] = [];
    let current = '';

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      const withSep = i < parts.length - 1 ? segment + sep : segment;

      if (current.length + withSep.length <= maxChars) {
        current += withSep;
      } else {
        if (current.length > 0) merged.push(current);
        current = withSep;
      }
    }
    if (current.length > 0) merged.push(current);

    // Recursively split any chunks that are still too large
    const result: string[] = [];
    for (const chunk of merged) {
      if (chunk.length <= maxChars) {
        result.push(chunk);
      } else {
        // Try remaining separators
        const remainingSeps = separators.slice(separators.indexOf(sep) + 1);
        if (remainingSeps.length > 0) {
          result.push(...splitRecursive(chunk, remainingSeps, maxChars));
        } else {
          // Hard split at maxChars as last resort
          for (let i = 0; i < chunk.length; i += maxChars) {
            result.push(chunk.slice(i, i + maxChars));
          }
        }
      }
    }

    return result;
  }

  // No separator found — hard split
  const result: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    result.push(text.slice(i, i + maxChars));
  }
  return result;
}

/**
 * Add overlap between consecutive chunks and compute offsets.
 */
function mergeWithOverlap(
  rawChunks: string[],
  originalText: string,
  maxChars: number,
  overlapChars: number,
): TextChunk[] {
  if (rawChunks.length === 0) return [];
  if (overlapChars <= 0) {
    // No overlap — just compute offsets
    let offset = 0;
    return rawChunks.map((content, index) => {
      const startOffset = originalText.indexOf(content, offset);
      const actualStart = startOffset >= 0 ? startOffset : offset;
      offset = actualStart + content.length;
      return { content, index, startOffset: actualStart, endOffset: offset };
    });
  }

  const chunks: TextChunk[] = [];
  let searchFrom = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    let content = rawChunks[i];

    // Add overlap from previous chunk
    if (i > 0 && overlapChars > 0) {
      const prevChunk = rawChunks[i - 1];
      const overlapText = prevChunk.slice(-overlapChars);
      const combined = overlapText + content;
      // Only add overlap if it doesn't exceed max
      if (combined.length <= maxChars) {
        content = combined;
      }
    }

    const startOffset = originalText.indexOf(content.slice(0, 50), Math.max(0, searchFrom - overlapChars));
    const actualStart = startOffset >= 0 ? startOffset : searchFrom;

    chunks.push({
      content,
      index: i,
      startOffset: actualStart,
      endOffset: actualStart + content.length,
    });

    searchFrom = actualStart + rawChunks[i].length;
  }

  return chunks;
}

/**
 * Estimate token count for a string.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
