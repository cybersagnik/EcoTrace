/**
 * Dependency-free RFC 4180-ish CSV parser. Handles:
 *  - quoted fields (", "" escapes)
 *  - commas / newlines inside quoted fields
 *  - CRLF and LF line endings
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/**
 * Splits a raw CSV string into header + data rows. No type coercion —
 * every cell stays a raw string for the validator to interpret.
 */
export function parseCsv(text: string): ParsedCsv {
  const fields: string[] = [];
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    pushField();
    if (row.length > 0 || records.length > 0) {
      records.push(row);
    }
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (ch === "\r") {
      // Treat \r\n as a single terminator.
      if (text[i + 1] === "\n") {
        i += 1;
      }
      pushRow();
      i += 1;
      continue;
    }

    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  // Flush trailing content (line may not end with a newline).
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  const headers = records.shift() ?? [];
  return { headers, rows: records };
}
