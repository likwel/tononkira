#!/usr/bin/env node
/**
 * Commandes Python de data/, identiques sous Linux, macOS et Windows (npm run data:*).
 *
 *   node scripts/data.mjs setup              crée data/.venv et installe le paquet
 *   node scripts/data.mjs test [args]        lance pytest
 *   node scripts/data.mjs <commande> [args]  python -m tononkira_data <commande> [args]
 *
 * Les arguments sont passés sans shell : pas de souci de guillemets sous cmd.exe.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
const WINDOWS = process.platform === 'win32';
const VENV_PYTHON = WINDOWS
  ? path.join(DATA_DIR, '.venv', 'Scripts', 'python.exe')
  : path.join(DATA_DIR, '.venv', 'bin', 'python');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: DATA_DIR, stdio: 'inherit' });
  if (result.error) {
    console.error(`Impossible de lancer ${command} : ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

/** Python 3.11+ du système : lanceur « py -3 » sous Windows, python3 ailleurs. */
function systemPython() {
  const candidates = WINDOWS
    ? [['py', ['-3']], ['python', []], ['python3', []]]
    : [['python3', []], ['python', []]];
  for (const [command, prefix] of candidates) {
    const probe = spawnSync(
      command,
      [...prefix, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'],
      { stdio: 'ignore' },
    );
    if (probe.status === 0) return [command, prefix];
  }
  return null;
}

const [command = 'stats', ...args] = process.argv.slice(2);

if (command === 'setup') {
  const python = systemPython();
  if (!python) {
    console.error('Python 3.11 ou plus est introuvable : installer Python puis relancer « npm run data:setup ».');
    process.exit(1);
  }
  const [executable, prefix] = python;
  // --copies : les disques NTFS montés sous Linux gèrent mal les liens symboliques du venv.
  let code = run(executable, [...prefix, '-m', 'venv', ...(WINDOWS ? [] : ['--copies']), '.venv']);
  if (code === 0) code = run(VENV_PYTHON, ['-m', 'pip', 'install', '-q', '-e', '.[dev]']);
  if (code === 0) console.log(`Environnement prêt : ${VENV_PYTHON}`);
  process.exit(code);
}

if (!existsSync(VENV_PYTHON)) {
  console.error(`Environnement Python absent (${VENV_PYTHON}) : lancer « npm run data:setup ».`);
  process.exit(1);
}

process.exit(
  command === 'test'
    ? run(VENV_PYTHON, ['-m', 'pytest', '-q', ...args])
    : run(VENV_PYTHON, ['-m', 'tononkira_data', command, ...args]),
);
