/**
 * Tailwind CSS download utility — shared between init and config commands
 */

import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

const TAILWIND_URL = 'https://cdn.tailwindcss.com/3.4.17';
const TAILWIND_FILENAME = 'tailwind.js';

export function downloadTailwind(toolingDir: string): Promise<void> {
  const targetPath = path.join(toolingDir, TAILWIND_FILENAME);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(targetPath);
    https.get(TAILWIND_URL, (response) => {
      // Follow redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect with no location header'));
          return;
        }
        https.get(redirectUrl, (res2) => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', (err) => {
          fs.unlinkSync(targetPath);
          reject(err);
        });
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
      reject(err);
    });
  });
}

export function tailwindExists(toolingDir: string): boolean {
  return fs.existsSync(path.join(toolingDir, TAILWIND_FILENAME));
}
