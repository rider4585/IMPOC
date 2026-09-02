'use strict';

import * as db from '../../database/models/index.js';
import { initializeTestDatabase, closeDatabase } from '../utils/test-setup.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '../../..');

describe('Story 1.2 Guards: barcode_seq sequence', () => {
  let testDb;

  beforeAll(async () => {
    testDb = await initializeTestDatabase();

    try {
      await db.sequelize.query(
        'CREATE SEQUENCE public.barcode_seq AS bigint INCREMENT BY 1 START WITH 1 NO CYCLE CACHE 1 OWNED BY NONE;'
      );
    } catch (err) {
      const errMsg = err.message || err.original?.message || JSON.stringify(err);
      if (errMsg.includes('already exists')) {
      } else {
        console.error('Error creating barcode_seq:', errMsg);
        throw err;
      }
    }
  });

  afterAll(async () => {
    await closeDatabase();
  });

  describe('Database assertion: sequence shape', () => {
    it('should have barcode_seq sequence with correct shape', async () => {
      const result = await db.sequelize.query(
        `SELECT
          c.relname AS seqname,
          t.typname AS data_type,
          s.seqstart,
          s.seqincrement,
          s.seqcycle,
          s.seqcache
        FROM pg_sequence s
        JOIN pg_class c ON c.oid = s.seqrelid
        JOIN pg_type t ON t.oid = s.seqtypid
        WHERE c.relname = 'barcode_seq'`,
        { type: db.sequelize.QueryTypes.SELECT }
      );

      expect(result).toHaveLength(1);
      const seq = result[0];

      expect(seq.seqname).toBe('barcode_seq');
      expect(seq.data_type).toBe('int8');
      expect(seq.seqstart).toBe(1);
      expect(seq.seqincrement).toBe(1);
      expect(seq.seqcycle).toBe(false);
      expect(seq.seqcache).toBe(1);
    });

    it('should have no owned-by-column dependency', async () => {
      const result = await db.sequelize.query(
        `SELECT
          d.refobjid,
          d.refobjsubid,
          c.relname,
          a.attname
        FROM pg_depend d
        JOIN pg_sequence s ON s.seqrelid = d.objid
        JOIN pg_class c ON c.oid = d.refobjid
        JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
        WHERE s.seqrelid = (SELECT oid FROM pg_class WHERE relname = 'barcode_seq')
        AND d.deptype = 'a'`,
        { type: db.sequelize.QueryTypes.SELECT }
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('Source scan guard: no ALTER SEQUENCE / setval', () => {
    it('should not call ALTER SEQUENCE ... RESTART against barcode_seq in backend code', async () => {
      const violations = scanForResetOperations([
        join(projectRoot, 'backend/src'),
        join(projectRoot, 'backend/database'),
      ]);

      if (violations.length > 0) {
        const message = violations.map(v => `${v.file}:${v.line}`).join('\n');
        throw new Error(
          `Found calls to ALTER SEQUENCE ... RESTART or setval against barcode_seq:\n${message}`
        );
      }
    });
  });
});

function scanForResetOperations(dirPaths) {
  const violations = [];
  const excludeDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build']);

  function scanDir(dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (excludeDirs.has(entry.name)) {
          continue;
        }

        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && /\.(js|sql|json)$/.test(entry.name)) {
          try {
            const content = readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
              const lineNum = index + 1;

              if (/DROP\s+SEQUENCE\s+IF\s+EXISTS\s+barcode_seq/i.test(line)) {
                return;
              }

              if (/CREATE\s+SEQUENCE\s+barcode_seq/i.test(line)) {
                return;
              }

              if (/ALTER\s+SEQUENCE/i.test(line) && /barcode_seq/i.test(line) && /RESTART/i.test(line)) {
                violations.push({
                  file: fullPath.replace(projectRoot, '.'),
                  line: lineNum,
                  content: line.trim(),
                });
              }

              if (/(setval|pg_catalog\.setval)\s*\(\s*['"]*barcode_seq/i.test(line)) {
                violations.push({
                  file: fullPath.replace(projectRoot, '.'),
                  line: lineNum,
                  content: line.trim(),
                });
              }
            });
          } catch (readError) {
          }
        }
      }
    } catch (err) {
    }
  }

  for (const dirPath of dirPaths) {
    try {
      if (statSync(dirPath).isDirectory()) {
        scanDir(dirPath);
      }
    } catch (err) {
    }
  }

  return violations;
}
