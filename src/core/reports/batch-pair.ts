/** Match the existing receipt naming convention exactly; never guess from list position. */
export function pairEvidenceFiles(
  fileNames: readonly string[],
  receiptNames: readonly string[],
  downloadedName?: (fileName: string) => string,
): { fileName: string; receiptName: string }[] {
  if (fileNames.length === 0 || fileNames.length > 50 || receiptNames.length !== fileNames.length)
    throw new Error('Select between 1 and 50 files and exactly one .ots receipt per file');
  if (fileNames.some(name => name.length === 0) || receiptNames.some(name => name.length === 0))
    throw new Error('Original filenames and receipt names must be non-empty');
  const files = new Set(fileNames);
  const receipts = new Set(receiptNames);
  if (files.size !== fileNames.length || receipts.size !== receiptNames.length)
    throw new Error('Duplicate filenames are ambiguous; rename files before batch verification');
  const claimed = new Set<string>();
  return fileNames.map(fileName => {
    const exact = fileName + '.ots';
    // Accept the browser's actual download name as well as a conventional, unchanged .ots sibling.
    const receiptName = receipts.has(exact) ? exact : downloadedName?.(fileName);
    if (!receiptName || !receipts.has(receiptName)) throw new Error('Missing matching receipt: ' + exact);
    if (claimed.has(receiptName)) throw new Error('Duplicate receipt names are ambiguous; rename files before batch verification');
    claimed.add(receiptName);
    return { fileName, receiptName };
  });
}
