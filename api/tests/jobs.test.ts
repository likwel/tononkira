import { describe, expect, it } from 'vitest';
import { JobRunner, pythonCommand } from '../src/admin/jobs.js';
import { FakeFileImporter, FakePython, IMPORT_REPORT, MemoryJobStore } from './admin-fakes.js';

const EXPORT = '/data/output/songs.jsonl';

function setup() {
  const python = new FakePython();
  const store = new MemoryJobStore();
  const importer = new FakeFileImporter();
  const runner = new JobRunner({ store, python, importer, exportPath: EXPORT });
  return { python, store, importer, runner };
}

describe('pythonCommand', () => {
  it('construit la collecte avec ses options', () => {
    expect(
      pythonCommand('crawl', { from: 9, to: 20, limit: 100, delay: 2, retryErrors: true }, EXPORT),
    ).toEqual([
      'crawl', '--events', '--out', EXPORT, '--from', '9', '--to', '20', '--limit', '100',
      '--retry-errors', '--delay', '2',
    ]);
  });

  it('part de la page 1 par défaut et traduit les autres tâches', () => {
    expect(pythonCommand('crawl', {}, EXPORT)).toEqual(['crawl', '--events', '--out', EXPORT, '--from', '1']);
    expect(pythonCommand('update', {}, EXPORT)).toEqual(['update', '--events', '--out', EXPORT]);
    expect(pythonCommand('recheck', { limit: 30 }, EXPORT)).toEqual([
      'recheck', '--events', '--out', EXPORT, '--limit', '30',
    ]);
    expect(pythonCommand('import', {}, EXPORT)).toEqual(['export', '--events', '--out', EXPORT]);
  });
});

describe('JobRunner', () => {
  it('suit la progression, importe le JSONL et enregistre le résumé', async () => {
    const { python, store, importer, runner } = setup();
    python.script = {
      logs: ['10:00:00 INFO    Liste page 9/9 : 20 chansons, 20 nouvelles'],
      events: [
        { event: 'phase', phase: 'lists', from: 9, to: 9 },
        { event: 'list_page', page: 9, last: 9, found: 20, new: 20 },
        { event: 'phase', phase: 'songs', total: 2 },
        { event: 'song', index: 2, total: 2, saved: 1, gone: 0, errors: 1 },
        { event: 'exported', count: 301 },
      ],
    };

    await runner.start('crawl', { from: 9, to: 9 });
    await runner.idle();

    const job = runner.current()!;
    expect(job.status).toBe('succeeded');
    expect(job.summary).toEqual({
      lists: { pages: 1, found: 20, new: 20 },
      songs: { total: 2, saved: 1, gone: 0, errors: 1 },
      exported: 301,
      import: IMPORT_REPORT,
    });
    expect(importer.paths).toEqual([EXPORT]);
    expect(store.jobs[0]).toMatchObject({ status: 'succeeded' });
    expect(store.jobs[0]!.log).toContain('Liste page 9/9');
  });

  it("n'importe pas quand c'est demandé", async () => {
    const { runner, importer } = setup();
    await runner.start('recheck', { limit: 5, importAfter: false });
    await runner.idle();
    expect(runner.current()!.status).toBe('succeeded');
    expect(importer.paths).toEqual([]);
  });

  it("passe en échec si la commande Python échoue, sans importer", async () => {
    const { python, runner, importer, store } = setup();
    python.script = { code: 1, logs: ['FetchError: HTTP 503'] };
    await runner.start('update', {});
    await runner.idle();
    const job = runner.current()!;
    expect(job.status).toBe('failed');
    expect(job.summary.error).toContain('code 1');
    expect(importer.paths).toEqual([]);
    expect(store.jobs[0]!.status).toBe('failed');
  });

  it("s'arrête proprement à la demande", async () => {
    const { python, runner, importer } = setup();
    python.script = { waitForAbort: true };
    const job = await runner.start('crawl', {});
    expect(runner.cancel(job.id)).toBe(true);
    await runner.idle();
    expect(runner.current()!.status).toBe('cancelled');
    expect(importer.paths).toEqual([]);
    expect(runner.cancel(job.id)).toBe(false);
  });

  it('refuse une deuxième tâche tant que la première tourne', async () => {
    const { python, runner } = setup();
    python.script = { waitForAbort: true };
    const job = await runner.start('crawl', {});
    await expect(runner.start('import', {})).rejects.toMatchObject({ status: 409 });
    runner.cancel(job.id);
    await runner.idle();
  });
});
