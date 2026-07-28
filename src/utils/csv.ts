export const parseCsvLine = (line: string) => {
  const values: string[] = [];
  let current = "";
  let isQuoted = false;

  for (const char of line) {
    if (char === '"') {
      isQuoted = !isQuoted;
    } else if (char === "," && !isQuoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

export const parseCsvRows = (csv: string) => {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0] ?? "");

  return {
    header,
    rows: lines.slice(1).map(parseCsvLine),
  };
};
