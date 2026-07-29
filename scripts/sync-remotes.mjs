#!/usr/bin/env node
/**
 * Synchronisation multi-remotes (origin + 2nd origin).
 *
 * Le meme script est utilise dans landingMoze (front) et landingMoze-back.
 * Tout ce qui est specifique au repo vit dans .sync-remotes.json a la racine.
 *
 * Usage :
 *   node scripts/sync-remotes.mjs setup                 # remotes + hook git
 *   node scripts/sync-remotes.mjs status                # etat local + etat de chaque remote
 *   node scripts/sync-remotes.mjs push "mon message"    # add -A + commit, puis pull/push partout
 *   node scripts/sync-remotes.mjs push                  # sans commit : pull/push de l'existant
 *   node scripts/sync-remotes.mjs hook <remote> <url>   # appele par .githooks/pre-push
 *
 * Pourquoi Node et pas bash : sur ce poste Windows, `bash` sur le PATH est celui
 * de WSL (C:\windows\system32\bash.exe), qui ne voit pas le meme disque. Node est
 * deja une dependance des deux projets, donc c'est le seul runtime commun fiable.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG_FILE = '.sync-remotes.json';
const HOOKS_DIR = '.githooks';
const ZERO_SHA = '0'.repeat(40);
/** Empeche le hook de se rappeler lui-meme quand il pousse vers les remotes secondaires. */
const REENTRY_FLAG = 'SYNC_REMOTES_IN_HOOK';

function fail(message) {
  console.error(`\n[ERREUR] ${message}`);
  process.exit(1);
}

function git(args, { capture = false, allowFail = false, env } = {}) {
  const res = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
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

  return {
    remotes,
    // Le premier remote declare est le remote de reference : c'est celui dont un
    // push declenche la propagation vers tous les autres.
    primary: remotes[0],
    secondaries: remotes.slice(1),
    hooks: { autoPull: true, ...(config.hooks ?? {}) },
    checks: Array.isArray(config.checks) ? config.checks : [],
  };
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
function lsRemoteSha(remoteName, ref) {
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
  return res.out ? res.out.split(/\s+/)[0] : null;
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

/**
 * Branche git sur .githooks/ au lieu de .git/hooks/, qui n'est pas versionne.
 * Le hook suit ainsi le repo : un clone frais n'a qu'un "setup" a lancer.
 */
function installHooks({ verbose = true } = {}) {
  const hookFile = join(repoRoot, HOOKS_DIR, 'pre-push');
  if (!existsSync(hookFile)) {
    console.log(`  ! ${HOOKS_DIR}/pre-push absent : hook non installe.`);
    return;
  }

  const current = git(['config', '--local', 'core.hooksPath'], { capture: true, allowFail: true });
  if (current.out === HOOKS_DIR) {
    if (verbose) console.log(`  = core.hooksPath deja sur ${HOOKS_DIR}`);
  } else {
    git(['config', '--local', 'core.hooksPath', HOOKS_DIR]);
    if (verbose) console.log(`  + core.hooksPath -> ${HOOKS_DIR}`);
  }

  // Sous Windows le bit d'execution n'existe pas sur le disque : on le force dans
  // l'index, sinon le hook est ignore sur les postes Unix apres un clone.
  git(['update-index', '--chmod=+x', `${HOOKS_DIR}/pre-push`], { allowFail: true, capture: true });
}

function runChecks(checks) {
  if (checks.length === 0) return;

  console.log('\n--- Verifications ---');
  for (const check of checks) {
    console.log(`> ${check}`);
    const res = spawnSync(check, { cwd: repoRoot, shell: true, stdio: 'inherit' });
    if (res.status !== 0) {
      fail(`la verification a echoue : ${check}\nRien n'a ete pousse.`);
    }
  }
}

function cmdSetup(config) {
  console.log(`Depot : ${repoRoot}`);
  console.log('Configuration des remotes :');
  ensureRemotes(config.remotes);

  console.log('Installation du hook :');
  installHooks();

  const branch = currentBranch();
  console.log(`\nBranche courante : ${branch}`);
  for (const remote of config.remotes) {
    console.log(`  ${remote.name} -> ${targetRef(remote, branch)}`);
  }
  console.log(
    `\nSetup termine. Un "git push ${config.primary.name}" propagera desormais vers : ` +
      `${config.secondaries.map((r) => r.name).join(', ') || '(aucun secondaire)'}.`,
  );
}

function cmdStatus(config) {
  const branch = currentBranch();
  console.log(`Depot   : ${repoRoot}`);
  console.log(`Branche : ${branch}`);

  const dirty = git(['status', '--porcelain'], { capture: true }).out;
  console.log(
    `Local   : ${dirty ? `${dirty.split('\n').length} fichier(s) non commite(s)` : 'propre'}`,
  );

  const hooksPath = git(['config', '--local', 'core.hooksPath'], { capture: true, allowFail: true });
  console.log(
    `Hook    : ${hooksPath.out === HOOKS_DIR ? 'actif' : 'INACTIF (lance "setup")'} ` +
      `[core.hooksPath = ${hooksPath.out || 'non defini'}]`,
  );

  console.log('\nRemotes :');
  for (const remote of config.remotes) {
    const ref = targetRef(remote, branch);
    const configured = git(['remote', 'get-url', remote.name], { capture: true, allowFail: true });

    if (configured.code !== 0) {
      console.log(`  ${remote.name} : NON CONFIGURE (lance "setup")`);
      continue;
    }

    const sha = lsRemoteSha(remote.name, ref);
    console.log(
      `  ${remote.name} : ${configured.out}\n` +
        `    branche cible ${ref} : ${sha ? sha.slice(0, 7) : 'absente (le prochain push la creera)'}`,
    );
  }
}

function cmdPush(config, args) {
  const message = args.find((arg) => !arg.startsWith('-'));
  const branch = currentBranch();

  console.log(`Depot   : ${repoRoot}`);
  console.log(`Branche : ${branch}\n`);

  ensureRemotes(config.remotes, { verbose: false });

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

  runChecks(config.checks);

  // --- Phase 1 : tout rapatrier avant de pousser quoi que ce soit ---
  // Sinon un pull tardif ajouterait des commits absents des remotes deja pousses.
  console.log('\n--- Pull ---');
  for (const remote of config.remotes) {
    const ref = targetRef(remote, branch);

    if (!lsRemoteSha(remote.name, ref)) {
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
  // Le hook pre-push se desactive : cette commande gere deja la propagation.
  console.log('\n--- Push ---');
  for (const remote of config.remotes) {
    const ref = targetRef(remote, branch);
    console.log(`${remote.name} : push ${branch} -> ${ref}`);
    git(['push', remote.name, `${branch}:refs/heads/${ref}`], { env: { [REENTRY_FLAG]: '1' } });
  }

  console.log(`\nTermine : ${branch} synchronisee sur ${config.remotes.length} remote(s).`);
}

/**
 * Hook pre-push : declenche par un `git push origin` classique.
 *
 * Limite structurelle de pre-push : git a deja fige le SHA a pousser avant
 * d'appeler le hook. Un `git pull` ici ne serait donc PAS pousse et git enverrait
 * un etat perime. En cas de retard sur origin, on rapatrie puis on annule le push :
 * le suivant partira sur une base saine.
 */
function cmdHook(config, [remoteName, remoteUrl]) {
  if (process.env[REENTRY_FLAG] === '1') return;

  const { primary, secondaries } = config;
  const isPrimary = remoteName === primary.name || remoteUrl === primary.url;
  if (!isPrimary || secondaries.length === 0) return;

  let stdin = '';
  try {
    stdin = readFileSync(0, 'utf8');
  } catch {
    stdin = '';
  }

  const refs = stdin
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [localRef, localSha, remoteRef, remoteShaOnPrimary] = line.split(/\s+/);
      return { localRef, localSha, remoteRef, remoteShaOnPrimary };
    });

  if (refs.length === 0) return;

  console.log(`\n[sync-remotes] propagation ${primary.name} -> ${secondaries.map((r) => r.name).join(', ')}`);

  runChecks(config.checks);

  for (const ref of refs) {
    if (ref.localSha === ZERO_SHA) {
      console.log(`[sync-remotes] ${ref.remoteRef} : suppression, non propagee (a faire a la main).`);
      continue;
    }

    const isTag = ref.localRef.startsWith('refs/tags/');
    const branch = ref.localRef.replace(/^refs\/heads\//, '');

    // --- Verif : sommes-nous a jour vis-a-vis du remote primaire ? ---
    if (!isTag && ref.remoteShaOnPrimary !== ZERO_SHA) {
      git(['fetch', '--quiet', primary.name, branch], { allowFail: true, capture: true });
      const upToDate = git(
        ['merge-base', '--is-ancestor', ref.remoteShaOnPrimary, ref.localSha],
        { allowFail: true, capture: true },
      );

      if (upToDate.code !== 0) {
        if (!config.hooks.autoPull) {
          fail(`${branch} est en retard sur ${primary.name}. Fais un "git pull" puis relance.`);
        }

        const dirty = git(['status', '--porcelain'], { capture: true }).out;
        if (dirty) {
          fail(
            `${branch} est en retard sur ${primary.name} et ton dossier de travail n'est pas propre.\n` +
              `Commit ou remise de cote, puis "git pull", puis relance ton push.`,
          );
        }

        console.log(`[sync-remotes] ${branch} en retard sur ${primary.name} : rapatriement...`);
        const pulled = git(['pull', '--no-rebase', primary.name, branch], { allowFail: true });
        fail(
          pulled.code === 0
            ? `${primary.name} a ete rapatrie dans ${branch}. Relance ton "git push" : il partira a jour.\n` +
                `(git ne peut pas pousser un merge cree pendant le hook, d'ou l'annulation.)`
            : `conflit au pull depuis ${primary.name}. Resous-le puis relance ton push.`,
        );
      }
    }

    // --- Propagation ---
    for (const secondary of secondaries) {
      const dest = isTag ? ref.localRef : `refs/heads/${targetRef(secondary, branch)}`;
      const destName = dest.replace(/^refs\/(heads|tags)\//, '');

      // Verif : le secondaire n'a-t-il pas diverge ? On ne force jamais.
      if (!isTag) {
        const remoteSha = lsRemoteSha(secondary.name, targetRef(secondary, branch));
        if (remoteSha) {
          git(['fetch', '--quiet', secondary.name, targetRef(secondary, branch)], {
            allowFail: true,
            capture: true,
          });
          const fastForward = git(['merge-base', '--is-ancestor', remoteSha, ref.localSha], {
            allowFail: true,
            capture: true,
          });
          if (fastForward.code !== 0) {
            fail(
              `${secondary.name}/${destName} a diverge de ta branche locale.\n` +
                `Lance "npm run push:both" pour fusionner proprement, puis repousse.\n` +
                `Le push vers ${primary.name} a ete annule pour garder les deux remotes alignes.`,
            );
          }
        }
      }

      console.log(`[sync-remotes] ${secondary.name} : ${ref.localSha.slice(0, 7)} -> ${destName}`);
      const pushed = git(['push', secondary.name, `${ref.localSha}:${dest}`], {
        allowFail: true,
        env: { [REENTRY_FLAG]: '1' },
      });
      if (pushed.code !== 0) {
        fail(
          `echec du push vers ${secondary.name} (${destName}).\n` +
            `Le push vers ${primary.name} a ete annule pour eviter que les deux remotes divergent.`,
        );
      }
    }
  }

  console.log('[sync-remotes] propagation OK, le push vers origin continue.\n');
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
  case 'hook':
    cmdHook(loadConfig(), rest);
    break;
  default:
    fail(`commande inconnue : "${command}" (attendu : setup | status | push | hook)`);
}
