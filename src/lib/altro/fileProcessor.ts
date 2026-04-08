/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

/**
 * Strict Privacy Rule: All file processing must happen locally in the browser.
 * No data is sent to external servers for parsing.
 */

const VALID_EXTENSIONS = ['.txt', '.md', '.json'];

export class FileProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileProcessingError';
  }
}

export async function processLocalFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!VALID_EXTENSIONS.includes(ext)) {
      return reject(new FileProcessingError(`Unsupported file format: ${ext}. Please use .txt, .md, or .json`));
    }

    const reader = new FileReader();
    
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new FileProcessingError('Failed to read file as text.'));
      }
    };
    
    reader.onerror = () => {
      reject(new FileProcessingError('Error reading file.'));
    };
    
    reader.readAsText(file);
  });
}
