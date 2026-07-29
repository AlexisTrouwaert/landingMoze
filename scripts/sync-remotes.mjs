#!/usr/bin/env node
/**
 * Synchronisation multi-remotes (origin + 2nd origin).
 *
 * Le meme script est utilise dans landingMoze (front) et landingMoze-back.
 * Tout ce qui est specifique au repo vit dans .sync-remotes.json a la racine.
 *
 * Usage :
 *   node scripts/sync-remotes.mjs setup                 # cree / met a jour les remotes
 *   node scripts/sync-remotes.mjs status                # etat local + etat de chaque remote
 *   node scripts/sync-remotes.mjs push "mon message"    # add -A + commit, puis pull/push partout
 *   node scripts/sync-remotes.mjs push                  # sans commit : pull/push de l'existant
 *
 * Pourquoi Node et pas bash : sur ce poste Windows, `bash` sur le PATH est celui
 * de WSL (C:\windows\system32\bash.exe), qui ne voit pas le meme disque. Node est
 * deja une dependance des deux projets, donc c'est le seul runtime commun fiable.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILE = '.sync-remotes.json';

function fail(message) {
  console.error(`\n[ERREUR] ${message}`);
  process.exit(1);
}

function git(args, { capture = false, allowFail = false } = {}) {
  const res = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (res.error) fail(`impossible de lancer git : ${res.error.message}`);

  if (res.status !== 0 && !allowFail) {
    if (capture && res.stderr) process.stderr.write(res.stderr);
    fail(`echec de : git ${args.join(' ')}`);
  }

  return {
    code: res.status,
    out: capture ? (res.stdout ?? '').trim() : '',
    err: capture ? (res.stderr ?? '').trim() : '',
  };
}

function findRepoRoot() {
  const res = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (res.error || res.status !== 0) {
    console.error('\n[ERREUR] pas dans un depot git (ou git introuvable).');
    process.exit(1);
  }
  return res.stdout.trim();
}

const repoRoot = findRepoRoot();

function loadConfig() {
  const path = join(repoRoot, CONFIG_FILE);
  if (!existsSync(path)) {
    fail(
      `${CONFIG_FILE} introuvable a la racine du depot (${repoRoot}).\n` +
        `Cree-le sur le modele :\n` +
        `{\n` +
        `  "remotes": [\n` +
        `    { "name": "origin",  "url": "https://github.com/…/repo.git", "branchPrefix": "" },\n` +
        `    { "name": "origin2", "url": "https://github.com/…/autre.git", "branchPrefix": "front/" }\n` +
        `  ]\n` +
        `}`,
    );
  }

  let config;
  try {
    config = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`${CONFIG_FILE} illisible : ${err.message}`);
  }

  const remotes = Array.isArray(config.remotes) ? config.remotes : [];
  if (remotes.length === 0) fail(`${CONFIG_FILE} ne declare aucun remote.`);

  for (const remote of remotes) {
    if (!remote.name) fail(`${CONFIG_FILE} : un remote n'a pas de "name".`);
    if (!remote.url) {
      fail(
        `${CONFIG_FILE} : le remote "${remote.name}" n'a pas d'"url".\n` +
          `Renseigne-la puis relance : node scripts/sync-remotes.mjs setup`,
      );
    }
    remote.branchPrefix = remote.branchPrefix ?? '';
  }

  return remotes;
}

/** Branche locale courante ; refuse le HEAD detache (rien a synchroniser de propre). */
function currentBranch() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true }).out;
  if (branch === 'HEAD') {
    fail('HEAD est detache : place-toi sur une branche avant de synchroniser.');
  }
  return branch;
}

/** Nom de la branche cote remote : le prefixe isole les repos qui partagent un depot. */
function targetRef(remote, branch) {
  return `${remote.branchPrefix}${branch}`;
}

/** Le remote connait-il deja cette branche ? Determine premier push vs pull prealable. */
function remoteHasBranch(remoteName, ref) {
  const res = git(['ls-remote', '--heads', remoteName, `refs/heads/${ref}`], {
    capture: true,
    allowFail: true,
  });
  if (res.code !== 0) {
    fail(
      `impossible de joindre le remote "${remoteName}".\n` +
        `${res.err || 'verifie ta connexion et tes acces au depot.'}`,
    );
  }
  return res.out.length > 0;
}

function ensureRemotes(remotes, { verbose = true } = {}) {
  for (const remote of remotes) {
    const existing = git(['remote', 'get-url', remote.name], { capture: true, allowFail: true });

    if (existing.code !== 0) {
      git(['remote', 'add', remote.name, remote.url]);
      if (verbose) console.log(`  + ${remote.name} ajoute -> ${remote.url}`);
    } else if (existing.out !== remote.url) {
      git(['remote', 'set-url', remote.name, remote.url]);
      if (verbose) console.log(`  ~ ${remote.name} corrige : ${existing.out} -> ${remote.url}`);
    } else if (verbose) {
      console.log(`  = ${remote.name} deja correct (${remote.url})`);
    }
  }
}

function cmdSetup(remotes) {
  console.log(`Depot : ${repoRoot}`);
  console.log('Configuration des remotes :');
  ensureRemotes(remotes);

  const branch = currentBranch();
  console.log(`\nBranche courante : ${branch}`);
  for (const remote of remotes) {
    console.log(`  ${remote.name} -> ${targetRef(remote, branch)}`);
  }
  console.log('\nSetup termine.');
}

function cmdStatus(remotes) {
  const branch = currentBranch();
  console.log(`Depot   : ${repoRoot}`);
  console.log(`Branche : ${branch}`);

  const dirty = git(['status', '--porcelain'], { capture: true }).out;
  console.log(
    `Local   : ${dirty ? `${dirty.split('\n').length} fichier(s) non commite(s)` : 'propre'}`,
  );

  console.log('\nRemotes :');
  for (const remote of remotes) {
    const ref = targetRef(remote, branch);
    const configured = git(['remote', 'get-url', remote.name], { capture: true, allowFail: true });

    if (configured.code !== 0) {
      console.log(`  ${remote.name} : NON CONFIGURE (lance "setup")`);
      continue;
    }

    const exists = remoteHasBranch(remote.name, ref);
    console.log(
      `  ${remote.name} : ${configured.out}\n` +
        `    branche cible ${ref} : ${exists ? 'presente' : 'absente (le prochain push la creera)'}`,
    );
  }
}

function cmdPush(remotes, args) {
  const message = args.find((arg) => !arg.startsWith('-'));
  const branch = currentBranch();

  console.log(`Depot   : ${repoRoot}`);
  console.log(`Branche : ${branch}\n`);

  ensureRemotes(remotes, { verbose: false });

  // --- Commit local ---
  if (message) {
    git(['add', '-A']);
    const committed = git(['commit', '-m', message], { allowFail: true });
    if (committed.code === 0) {
      console.log(`\nCommit cree sur ${branch}.`);
    } else {
      console.log('\nRien a committer : on continue avec le pull/push.');
    }
  } else {
    const dirty = git(['status', '--porcelain'], { capture: true }).out;
    if (dirty) {
      console.log(
        'Aucun message fourni : les modifications non commitees ne seront PAS poussees.\n' +
          'Pour les inclure : push-both "mon message".',
      );
    }
  }

  // --- Phase 1 : tout rapatrier avant de pousser quoi que ce soit ---
  // Sinon un pull tardif ajouterait des commits absents des remotes deja pousses.
  console.log('\n--- Pull ---');
  for (const remote of remotes) {
    const ref = targetRef(remote, branch);

    if (!remoteHasBranch(remote.name, ref)) {
      console.log(`${remote.name} : ${ref} n'existe pas encore, rien a rapatrier.`);
      continue;
    }

    console.log(`${remote.name} : pull de ${ref}`);
    const pulled = git(['pull', '--no-rebase', remote.name, ref], { allowFail: true });
    if (pulled.code !== 0) {
      fail(
        `conflit ou erreur au pull depuis ${remote.name} (${ref}).\n` +
          `Resous le conflit puis relance le script. Rien n'a ete pousse.`,
      );
    }
  }

  // --- Phase 2 : pousser l'etat consolide partout ---
  console.log('\n--- Push ---');
  for (const remote of remotes) {
    const ref = targetRef(remote, branch);
    console.log(`${remote.name} : push ${branch} -> ${ref}`);
    git(['push', remote.name, `${branch}:refs/heads/${ref}`]);
  }

  console.log(`\nTermine : ${branch} synchronisee sur ${remotes.length} remote(s).`);
}

const [command = 'push', ...rest] = process.argv.slice(2);

switch (command) {
  case 'setup':
    cmdSetup(loadConfig());
    break;
  case 'status':
    cmdStatus(loadConfig());
    break;
  case 'push':
    cmdPush(loadConfig(), rest);
    break;
  default:
    fail(`commande inconnue : "${command}" (attendu : setup | status | push)`);
}
