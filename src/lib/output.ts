const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export { green, red, yellow, bold, dim };

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log(dim("No data to display."));
    return;
  }

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxDataWidth = rows.reduce(
      (max, row) => Math.max(max, (row[i] || "").length),
      0
    );
    return Math.max(h.length, maxDataWidth);
  });

  // Print header
  const headerLine = headers
    .map((h, i) => bold(h.padEnd(colWidths[i])))
    .join("  ");
  console.log(headerLine);

  // Print separator
  const separator = colWidths.map((w) => dim("-".repeat(w))).join("  ");
  console.log(separator);

  // Print rows
  for (const row of rows) {
    const line = row.map((cell, i) => (cell || "").padEnd(colWidths[i])).join("  ");
    console.log(line);
  }
}

export function printSuccess(message: string): void {
  console.log(green(`\u2713 ${message}`));
}

export function printError(message: string): void {
  console.error(red(`\u2717 ${message}`));
}

export function printWarning(message: string): void {
  console.warn(yellow(`\u26A0 ${message}`));
}
