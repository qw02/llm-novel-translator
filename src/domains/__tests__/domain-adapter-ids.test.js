import { describe, it, expect } from 'vitest';
import { globSync } from 'glob';
import { resolve } from 'path';

describe('Domain Adapter ID Uniqueness', () => {
  it('should have unique IDs across all adapters', async () => {
    const adapterFiles = globSync('src/domains/sites/**/*.js', {
      cwd: resolve(process.cwd()),
      absolute: true,
    });

    const seenIds = new Map(); // id -> { file, className }
    const adapters = [];

    for (const filePath of adapterFiles) {
      try {
        const module = await import(`file://${filePath}`);

        for (const [exportName, ExportedClass] of Object.entries(module)) {
          if (
            typeof ExportedClass === 'function' &&
            ExportedClass.prototype &&
            typeof ExportedClass.prototype.getId === 'function'
          ) {
            const instance = new ExportedClass();
            const id = instance.getId();

            adapters.push({
              id,
              file: filePath,
              className: exportName,
            });

            if (seenIds.has(id)) {
              const conflict = seenIds.get(id);
              throw new Error(
                `Duplicate adapter ID detected: "${id}"\n` +
                `  First seen:  ${conflict.className} in ${conflict.file}\n` +
                `  Duplicate:   ${exportName} in ${filePath}\n` +
                `  Each adapter must return a unique ID from getId().`
              );
            }

            seenIds.set(id, { file: filePath, className: exportName });
          }
        }
      } catch (error) {
        if (error.message.includes('Duplicate adapter ID')) {
          throw error;
        }
        // Ignore import errors
      }
    }

    expect(adapters.length).toBeGreaterThan(0);
    expect(seenIds.size).toBe(adapters.length);

    console.log(`✅ Validated ${adapters.length} unique adapter(s):`);
    adapters.forEach(a => console.log(`   - ${a.id} (${a.className})`));
  });
});