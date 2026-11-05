/**
 * Lancement de la ligne de commande Python de data/ (`python -m tononkira_data …`).
 * La sortie standard porte des événements JSON (option --events ou --json), la sortie
 * d'erreur le journal lisible.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { HttpError } from '../lib/http-error.js';

/** Python du venv de data/ : `.venv/bin/python` (Linux, macOS) ou `.venv\Scripts\python.exe` (Windows). */
export function defaultPythonBin(
  dataDir: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === 'win32'
    ? path.win32.join(dataDir, '.venv', 'Scripts', 'python.exe')
    : path.posix.join(dataDir, '.venv', 'bin', 'python');
}

/**
 * Variables transmises au processus Python. Aucune variable de l'API (DATABASE_URL,
 * ADMIN_TOKEN…) : seulement ce qu'il faut pour démarrer (Windows exige SYSTEMROOT) et
 * sortir sur le réseau (proxy, certificats d'entreprise).
 */
const INHERITED_ENV = [
  'PATH',
  'PATHEXT',
  'HOME',
  'USERPROFILE',
  'LANG',
  'LC_ALL',
  'TMPDIR',
  'TEMP',
  'TMP',
  'SYSTEMROOT',
  'WINDIR',
  'COMSPEC',
  'APPDATA',
  'LOCALAPPDATA',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
];

export function pythonEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PYTHONUNBUFFERED: '1',
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
  };
  // Sous Windows les noms de variables ne tiennent pas compte de la casse (Path, SystemRoot…).
  const keys = Object.keys(source);
  for (const name of INHERITED_ENV) {
    const key = keys.find((candidate) => candidate.toUpperCase() === name.toUpperCase()) ?? name;
    if (source[key] !== undefined) env[name] = source[key];
  }
  return env;
}

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
        env: pythonEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      createInterface({ input: child.stdout }).on('line', (line) => {
        const event = parseEvent(line);
        if (event) onEvent?.(event);
        else if (line.trim()) onLog?.(line);
      });
      createInterface({ input: child.stderr }).on('line', (line) => {
        if (line.trim()) onLog?.(line);
      });

      // Linux/macOS : SIGINT laisse la collecte enregistrer son état. Windows n'a pas de
      // signaux : le processus est arrêté net, l'état SQLite reste cohérent (une écriture par page).
      const abort = () => child.kill('SIGINT');
      if (signal?.aborted) abort();
      signal?.addEventListener('abort', abort, { once: true });

      child.on('error', (error) => {
        signal?.removeEventListener('abort', abort);
        reject(
          new HttpError(
            503,
            'python_unavailable',
            `Python introuvable (${this.pythonBin}) : lancer « npm run data:setup » ` +
              `ou définir PYTHON_BIN dans api/.env. (${error.message})`,
          ),
        );
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
