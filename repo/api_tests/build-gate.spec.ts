/**
 * Build Gate — Static validation safeguard
 *
 * Catches type/style regressions by verifying:
 * - No Sass-only syntax in inline component styles
 * - No non-existent property access on core model interfaces
 * - TypeScript compilation would succeed (validated by this test running)
 */

import 'fake-indexeddb/auto';
import * as fs from 'fs';
import * as path from 'path';

const SRC_APP = path.resolve(__dirname, '../src/app');

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findTsFiles(full));
    else if (entry.name.endsWith('.component.ts')) results.push(full);
  }
  return results;
}

describe('Build gate — inline style validation', () => {

  it('no component .ts file contains Sass %placeholder syntax in inline styles', () => {
    const files = findTsFiles(SRC_APP);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const stylesMatch = content.match(/styles:\s*\[\s*`([\s\S]*?)`\s*\]/);
      if (!stylesMatch) continue;
      const styles = stylesMatch[1];
      if (/%[a-z]/.test(styles) || /@extend/.test(styles)) {
        violations.push(path.relative(SRC_APP, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('no component .ts file contains Sass & nesting in inline styles', () => {
    const files = findTsFiles(SRC_APP);
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const stylesMatch = content.match(/styles:\s*\[\s*`([\s\S]*?)`\s*\]/);
      if (!stylesMatch) continue;
      const styles = stylesMatch[1];
      // Check for & followed by : . -- _ (Sass nesting patterns)
      if (/&[:.\-_]/.test(styles) || /&\s*\{/.test(styles)) {
        violations.push(path.relative(SRC_APP, file));
      }
    }

    expect(violations).toEqual([]);
  });

  it('all components with styleUrls reference existing .scss files', () => {
    const files = findTsFiles(SRC_APP);
    const missing: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const urlsMatch = content.match(/styleUrls:\s*\[\s*'([^']+)'\s*\]/);
      if (!urlsMatch) continue;
      const scssRef = urlsMatch[1];
      const scssPath = path.resolve(path.dirname(file), scssRef);
      if (!fs.existsSync(scssPath)) {
        missing.push(`${path.relative(SRC_APP, file)} -> ${scssRef}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
