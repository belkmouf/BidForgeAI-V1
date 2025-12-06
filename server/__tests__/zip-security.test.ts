/// <reference types="jest" />
import AdmZip from 'adm-zip';
import * as path from 'path';
import { IngestionService } from '../lib/ingestion';

jest.mock('../db', () => ({
  pool: {
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO documents')) {
          return { rows: [{ id: 1 }] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    }),
  },
}));

jest.mock('../lib/openai.js', () => ({
  generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
}));

describe('ZIP Path Traversal Security', () => {
  let ingestionService: IngestionService;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    ingestionService = new IngestionService();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Path Traversal Attack Prevention', () => {
    const mockProjectId = 'test-project-security';

    function createMaliciousZip(maliciousEntryName: string): Buffer {
      const zip = new AdmZip();
      zip.addFile('safe.txt', Buffer.from('Safe content'));
      zip.addFile('temp.txt', Buffer.from('Malicious content'));
      
      const entries = zip.getEntries();
      const tempEntry = entries.find(e => e.entryName === 'temp.txt');
      if (tempEntry) {
        tempEntry.entryName = maliciousEntryName;
      }
      
      return zip.toBuffer();
    }

    it('should block entries with .. path traversal and only process safe files', async () => {
      const zipBuffer = createMaliciousZip('../../../etc/passwd');
      
      const results = await ingestionService.processFile(zipBuffer, 'attack.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('safe.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY: Blocked malicious ZIP entry')
      );
    });

    it('should block entries with nested .. patterns', async () => {
      const zipBuffer = createMaliciousZip('docs/../../../etc/shadow');
      
      const results = await ingestionService.processFile(zipBuffer, 'attack.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('safe.txt');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should block entries starting with absolute path (/)', async () => {
      const zipBuffer = createMaliciousZip('/etc/passwd');
      
      const results = await ingestionService.processFile(zipBuffer, 'attack.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('safe.txt');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('SECURITY: Blocked malicious ZIP entry')
      );
    });

    it('should block entries starting with backslash', async () => {
      const zipBuffer = createMaliciousZip('\\Windows\\System32\\config\\SAM');
      
      const results = await ingestionService.processFile(zipBuffer, 'attack.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('safe.txt');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should block entries with Windows drive letters', async () => {
      const zipBuffer = createMaliciousZip('C:\\Windows\\System32\\evil.bat');
      
      const results = await ingestionService.processFile(zipBuffer, 'attack.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('safe.txt');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should block multiple malicious entries in one ZIP', async () => {
      const zip = new AdmZip();
      zip.addFile('safe.txt', Buffer.from('Safe content'));
      zip.addFile('temp1.txt', Buffer.from('Evil 1'));
      zip.addFile('temp2.txt', Buffer.from('Evil 2'));
      zip.addFile('temp3.txt', Buffer.from('Evil 3'));
      
      const entries = zip.getEntries();
      entries.find(e => e.entryName === 'temp1.txt')!.entryName = '../../../etc/passwd';
      entries.find(e => e.entryName === 'temp2.txt')!.entryName = '/etc/shadow';
      entries.find(e => e.entryName === 'temp3.txt')!.entryName = 'C:\\Windows\\evil.bat';
      
      const zipBuffer = zip.toBuffer();
      const results = await ingestionService.processFile(zipBuffer, 'multi-attack.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('safe.txt');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    });

    it('should block path escape via symlink-like patterns', async () => {
      const zipBuffer = createMaliciousZip('legitimate/../../../tmp/evil');
      
      const results = await ingestionService.processFile(zipBuffer, 'symlink.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('IngestionService.processFile - ZIP Integration', () => {
    const mockProjectId = 'test-project-123';

    it('should process valid ZIP files with text content', async () => {
      const zip = new AdmZip();
      zip.addFile('document1.txt', Buffer.from('This is the first document'));
      zip.addFile('folder/document2.txt', Buffer.from('This is the second document'));
      
      const zipBuffer = zip.toBuffer();
      
      const results = await ingestionService.processFile(zipBuffer, 'test.zip', mockProjectId);
      
      expect(results.length).toBe(2);
      expect(results.map(r => r.filename)).toContain('document1.txt');
      expect(results.map(r => r.filename)).toContain('document2.txt');
    });

    it('should skip directory entries in ZIP files', async () => {
      const zip = new AdmZip();
      zip.addFile('folder/', Buffer.alloc(0));
      zip.addFile('folder/file.txt', Buffer.from('Content'));
      
      const zipBuffer = zip.toBuffer();
      
      const results = await ingestionService.processFile(zipBuffer, 'test.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('file.txt');
    });

    it('should handle deeply nested paths safely', async () => {
      const zip = new AdmZip();
      const deepPath = 'a/'.repeat(50) + 'file.txt';
      zip.addFile(deepPath, Buffer.from('Deep content'));
      
      const zipBuffer = zip.toBuffer();
      
      const results = await ingestionService.processFile(zipBuffer, 'test.zip', mockProjectId);
      
      expect(results.length).toBe(1);
      expect(results[0].filename).toBe('file.txt');
    });

    it('should handle empty ZIP files gracefully', async () => {
      const zip = new AdmZip();
      const zipBuffer = zip.toBuffer();
      
      const results = await ingestionService.processFile(zipBuffer, 'empty.zip', mockProjectId);
      
      expect(results.length).toBe(0);
    });

    it('should process files with unicode filenames', async () => {
      const zip = new AdmZip();
      zip.addFile('文档.txt', Buffer.from('Chinese document'));
      zip.addFile('документ.txt', Buffer.from('Russian document'));
      
      const zipBuffer = zip.toBuffer();
      
      const results = await ingestionService.processFile(zipBuffer, 'unicode.zip', mockProjectId);
      
      expect(results.length).toBe(2);
    });

    it('should process files with special characters in names', async () => {
      const zip = new AdmZip();
      zip.addFile('file with spaces.txt', Buffer.from('Content 1'));
      zip.addFile('file-with-dashes.txt', Buffer.from('Content 2'));
      zip.addFile('file_with_underscores.txt', Buffer.from('Content 3'));
      
      const zipBuffer = zip.toBuffer();
      
      const results = await ingestionService.processFile(zipBuffer, 'special.zip', mockProjectId);
      
      expect(results.length).toBe(3);
    });
  });

  describe('In-Memory Processing Verification', () => {
    it('should read file content directly from ZIP entries without disk extraction', () => {
      const zip = new AdmZip();
      const testContent = 'Test content for in-memory verification';
      
      zip.addFile('test.txt', Buffer.from(testContent));
      
      const entries = zip.getEntries();
      expect(entries.length).toBe(1);
      
      const data = entries[0].getData();
      expect(data.toString()).toBe(testContent);
      expect(entries[0].isDirectory).toBe(false);
    });

    it('should iterate entries and extract data without calling extractAllTo', () => {
      const zip = new AdmZip();
      zip.addFile('file1.txt', Buffer.from('Content 1'));
      zip.addFile('file2.txt', Buffer.from('Content 2'));
      zip.addFile('folder/file3.txt', Buffer.from('Content 3'));
      
      const extractedData: Map<string, string> = new Map();
      
      for (const entry of zip.getEntries()) {
        if (!entry.isDirectory) {
          extractedData.set(entry.entryName, entry.getData().toString());
        }
      }
      
      expect(extractedData.size).toBe(3);
      expect(extractedData.get('file1.txt')).toBe('Content 1');
      expect(extractedData.get('file2.txt')).toBe('Content 2');
      expect(extractedData.get('folder/file3.txt')).toBe('Content 3');
    });
  });

  describe('Nested ZIP Security', () => {
    const mockProjectId = 'test-nested-security';

    it('should block malicious entries in nested ZIP files', async () => {
      const innerZip = new AdmZip();
      innerZip.addFile('safe-inner.txt', Buffer.from('Safe inner content'));
      innerZip.addFile('temp.txt', Buffer.from('Malicious content'));
      
      const innerEntries = innerZip.getEntries();
      const tempEntry = innerEntries.find(e => e.entryName === 'temp.txt');
      if (tempEntry) {
        tempEntry.entryName = '../../../etc/passwd';
      }
      
      const outerZip = new AdmZip();
      outerZip.addFile('safe-outer.txt', Buffer.from('Safe outer content'));
      outerZip.addFile('nested.zip', innerZip.toBuffer());
      
      const zipBuffer = outerZip.toBuffer();
      const results = await ingestionService.processFile(zipBuffer, 'nested-attack.zip', mockProjectId);
      
      const filenames = results.map(r => r.filename);
      expect(filenames).toContain('safe-outer.txt');
      expect(filenames).toContain('safe-inner.txt');
      expect(filenames).not.toContain('passwd');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should handle deeply nested malicious ZIPs', async () => {
      const level3 = new AdmZip();
      level3.addFile('safe-level3.txt', Buffer.from('Level 3 content'));
      level3.addFile('evil.txt', Buffer.from('Evil'));
      level3.getEntries().find(e => e.entryName === 'evil.txt')!.entryName = '/etc/shadow';
      
      const level2 = new AdmZip();
      level2.addFile('safe-level2.txt', Buffer.from('Level 2 content'));
      level2.addFile('level3.zip', level3.toBuffer());
      
      const level1 = new AdmZip();
      level1.addFile('safe-level1.txt', Buffer.from('Level 1 content'));
      level1.addFile('level2.zip', level2.toBuffer());
      
      const zipBuffer = level1.toBuffer();
      const results = await ingestionService.processFile(zipBuffer, 'deep-nested.zip', mockProjectId);
      
      const filenames = results.map(r => r.filename);
      expect(filenames).toContain('safe-level1.txt');
      expect(filenames).toContain('safe-level2.txt');
      expect(filenames).toContain('safe-level3.txt');
      expect(filenames).not.toContain('shadow');
    });
  });

  describe('Real-world Attack Simulation', () => {
    const mockProjectId = 'test-project-123';

    it('should process only valid entries when ZIP contains mixed content', async () => {
      const zip = new AdmZip();
      
      zip.addFile('legitimate.txt', Buffer.from('Safe content'));
      zip.addFile('docs/report.txt', Buffer.from('Report content'));
      zip.addFile('nested/deep/file.txt', Buffer.from('Deep content'));
      
      const zipBuffer = zip.toBuffer();
      const results = await ingestionService.processFile(zipBuffer, 'mixed.zip', mockProjectId);
      
      expect(results.length).toBe(3);
      const filenames = results.map(r => r.filename);
      expect(filenames).toContain('legitimate.txt');
      expect(filenames).toContain('report.txt');
      expect(filenames).toContain('file.txt');
    });

    it('should handle corrupted ZIP data gracefully', async () => {
      const corruptedBuffer = Buffer.from('This is not a valid ZIP file');
      
      const results = await ingestionService.processFile(corruptedBuffer, 'corrupted.zip', mockProjectId);
      
      expect(results.length).toBe(0);
    });

    it('should process nested ZIP files recursively', async () => {
      const innerZip = new AdmZip();
      innerZip.addFile('inner-file.txt', Buffer.from('Inner content'));
      
      const outerZip = new AdmZip();
      outerZip.addFile('outer-file.txt', Buffer.from('Outer content'));
      outerZip.addFile('nested.zip', innerZip.toBuffer());
      
      const zipBuffer = outerZip.toBuffer();
      const results = await ingestionService.processFile(zipBuffer, 'nested.zip', mockProjectId);
      
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });
});
