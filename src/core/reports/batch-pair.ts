/** Match the existing receipt naming convention exactly; never guess from list position. */
export function pairEvidenceFiles(
  fileNames: readonly string[],
  receiptNames: readonly string[],
): { fileName: string; receiptName: string }[] {
  if (fileNames.length === 0 || fileNames.length > 50 || receiptNames.length !== fileNames.length)
    throw new Error('Select between 1 and 50 files and exactly one .ots receipt per file');
  const files = new Set(fileNames);
  const receipts = new Set(receiptNames);
  if (files.size !== fileNames.length || receipts.size !== receiptNames.length)
    throw new Error('Duplicate filenames are ambiguous; rename files before batch verification');
  for (const name of fileNames) {
    if (!receipts.has(name + '.ots')) throw new Error('Missing matching receipt: ' + name + '.ots');
  }
  return fileNames.map(fileName => ({ fileName, receiptName: fileName + '.ots' }));
}
