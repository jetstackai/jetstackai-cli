const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export { green, red, yellow, bold, dim };

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export type TableCell = string | number | boolean | null | undefined;

// Coerce any cell value to a printable string. Numbers/booleans appear in
// status views (e.g. Total=7, archive=false); without coercion the row
// renderer crashes on `cell.padEnd is not a function`.
function cellToString(cell: TableCell): string {
  if (cell === null || cell === undefined) return "";
  return typeof cell === "string" ? cell : String(cell);
}

export function printTable(headers: string[], rows: TableCell[][]): void {
  if (rows.length === 0) {
    console.log(dim("No data to display."));
    return;
  }

  // Calculate column widths
  const colWidths = headers.map((h, i) => {
    const maxDataWidth = rows.reduce(
      (max, row) => Math.max(max, cellToString(row[i]).length),
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
    const line = row
      .map((cell, i) => cellToString(cell).padEnd(colWidths[i]))
      .join("  ");
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

export interface TreeRenderNode {
  label: string;
  /** Optional annotation appended in dim after the label */
  hint?: string;
  children?: TreeRenderNode[];
}

/**
 * Print a tree using box-drawing characters. Mirrors `tree(1)` output.
 * Root label is printed plain; children are prefixed by `\u251C\u2500`/`\u2514\u2500` etc.
 */
export function printTree(root: TreeRenderNode): void {
  const render = (
    node: TreeRenderNode,
    prefix: string,
    isLast: boolean,
    isRoot: boolean
  ): void => {
    const branch = isRoot ? "" : isLast ? "\u2514\u2500 " : "\u251C\u2500 ";
    const line = `${prefix}${branch}${node.label}${
      node.hint ? ` ${dim(node.hint)}` : ""
    }`;
    console.log(line);
    const children = node.children ?? [];
    const childPrefix = isRoot
      ? ""
      : prefix + (isLast ? "   " : "\u2502  ");
    children.forEach((c, i) => {
      render(c, childPrefix, i === children.length - 1, false);
    });
  };
  render(root, "", true, true);
}
