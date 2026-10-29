/**
 * Lancement de la ligne de commande Python de data/ (`python -m tononkira_data …`).
 * La sortie standard porte des événements JSON (option --events ou --json), la sortie
 * d'erreur le journal lisible.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export type PythonEvent = Record<string, unknown>;

export interface PythonRunHandlers {
  onEvent?: (event: PythonEvent) => void;
  onLog?: (line: string) => void;
  /** Interrompt le processus (SIGINT : la collecte enregistre son état et s'arrête). */
  signal?: AbortSignal;
}

export interface PythonRunner {
  run(args: string[], handlers?: PythonRunHandlers): Promise<{ code: number | null }>;
}

export class ProcessPythonRunner implements PythonRunner {
  constructor(
    private readonly pythonBin: string,
    private readonly dataDir: string,
  ) {}

  run(args: string[], { onEvent, onLog, signal }: PythonRunHandlers = {}) {
    return new Promise<{ code: number | null }>((resolve, reject) => {
      const child = spawn(this.pythonBin, ['-m', 'tononkira_data', ...args], {
        cwd: this.dataDir,
        // Environnement minimal : le processus n'a besoin d'aucun secret de l'API.
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          LANG: process.env.LANG ?? 'C.UTF-8',
          PYTHONUNBUFFERED: '1',
          PYTHONIOENCODING: 'utf-8',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      createInterface({ input: child.stdout }).on('line', (line) => {
        const event = parseEvent(line);
        if (event) onEvent?.(event);
        else if (line.trim()) onLog?.(line);
      });
      createInterface({ input: child.stderr }).on('line', (line) => {
        if (line.trim()) onLog?.(line);
      });

      const abort = () => child.kill('SIGINT');
      if (signal?.aborted) abort();
      signal?.addEventListener('abort', abort, { once: true });

      child.on('error', (error) => {
        signal?.removeEventListener('abort', abort);
        reject(new Error(`Impossible de lancer ${this.pythonBin} : ${error.message}`));
      });
      child.on('close', (code) => {
        signal?.removeEventListener('abort', abort);
        resolve({ code });
      });
    });
  }
}

export function parseEvent(line: string): PythonEvent | null {
  if (!line.startsWith('{')) return null;
  try {
    const value: unknown = JSON.parse(line);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as PythonEvent)
      : null;
  } catch {
    return null;
  }
}
