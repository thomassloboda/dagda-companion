#!/usr/bin/env node
/**
 * Generates user-friendly localized changelog entries using OpenAI
 * and injects them into the i18n locale files + SettingsPage.tsx.
 *
 * Called automatically by release-it after each version bump.
 * Usage: OPENAI_API_KEY=sk-... node scripts/generate-changelog.mjs <version>
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// ── Args & env ──────────────────────────────────────────────────────────────

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/generate-changelog.mjs <version>");
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn(
    "⚠️  OPENAI_API_KEY non définie — les locales ne seront pas mises à jour.\n" +
      "   Définissez la variable et relancez : OPENAI_API_KEY=sk-... npm run release",
  );
  process.exit(0);
}

// ── Commits since last tag ───────────────────────────────────────────────────

let commits = "";
try {
  const lastTag = execSync("git describe --tags --abbrev=0 2>/dev/null || true", {
    encoding: "utf-8",
    shell: true,
  }).trim();

  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  commits = execSync(`git log ${range} --pretty=format:"%s" --no-merges`, {
    encoding: "utf-8",
  }).trim();
} catch {
  commits = execSync('git log HEAD --pretty=format:"%s" --no-merges', {
    encoding: "utf-8",
  }).trim();
}

// Filter out release commits themselves
commits = commits
  .split("\n")
  .filter((l) => l && !l.startsWith("chore(config): release"))
  .join("\n");

if (!commits) {
  console.log("Aucun commit utilisateur depuis le dernier tag — changelog ignoré.");
  process.exit(0);
}

console.log(`\n📝 Génération du changelog v${version} via OpenAI…`);

// ── OpenAI call ──────────────────────────────────────────────────────────────

const res = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Tu es un rédacteur technique qui rédige des notes de mise à jour pour des utilisateurs finaux non-techniques d'une application mobile de gestion de partie de jeu de rôle.

À partir d'une liste de commits git (format Conventional Commits), génère des entrées de changelog claires et compréhensibles en français et en anglais.

Règles :
- Écris du point de vue de l'utilisateur ("Vous pouvez maintenant…", "You can now…", "La page X affiche désormais…")
- Regroupe les commits liés en une seule entrée concise
- Ignore les commits techniques sans impact utilisateur (ci, chore, build, refactor, config, deps)
- Ignore les commits de release (chore(config): release…)
- Maximum 8 entrées par langue, minimum 1
- Chaque entrée fait une seule phrase, sans bullet point ni tiret
- Retourne UNIQUEMENT un objet JSON valide : {"fr": ["entrée 1", "entrée 2"], "en": ["entry 1", "entry 2"]}`,
      },
      {
        role: "user",
        content: `Version : v${version}\n\nCommits :\n${commits}`,
      },
    ],
  }),
});

if (!res.ok) {
  console.error("Erreur OpenAI :", await res.text());
  process.exit(1);
}

const { choices } = await res.json();
let parsed;
try {
  parsed = JSON.parse(choices[0].message.content);
} catch {
  console.error("Réponse OpenAI non parseable :", choices[0].message.content);
  process.exit(1);
}

const { fr, en } = parsed;
if (!Array.isArray(fr) || !Array.isArray(en) || fr.length === 0) {
  console.error("Format de réponse inattendu :", parsed);
  process.exit(1);
}

console.log(`   FR : ${fr.length} entrée(s)`);
console.log(`   EN : ${en.length} entry(ies)`);

// ── Update locale files ──────────────────────────────────────────────────────

const vKey = `v${version.replace(/\./g, "_")}`;

function updateLocale(filePath, items, label) {
  const locale = JSON.parse(readFileSync(filePath, "utf-8"));
  // Prepend new version (most recent first in the object)
  locale.changelog = { [vKey]: { label, items }, ...locale.changelog };
  writeFileSync(filePath, JSON.stringify(locale, null, 2) + "\n", "utf-8");
  console.log(`   ✓ ${path.relative(root, filePath)}`);
}

updateLocale(
  path.join(root, "src/ui/locales/fr-FR/translation.json"),
  fr,
  `v${version} — Nouveautés`,
);

updateLocale(
  path.join(root, "src/ui/locales/en-US/translation.json"),
  en,
  `v${version} — What's new`,
);

// ── Update CHANGELOG_VERSIONS in SettingsPage.tsx ───────────────────────────

const settingsPath = path.join(root, "src/ui/pages/SettingsPage.tsx");
let src = readFileSync(settingsPath, "utf-8");

if (!src.includes(`"${vKey}"`)) {
  // Prepend new version (most recent first)
  src = src.replace(
    /const CHANGELOG_VERSIONS = \[([^\]]*)\] as const;/,
    (_, inner) => {
      const trimmed = inner.trim();
      const entries = trimmed ? `"${vKey}", ${trimmed}` : `"${vKey}"`;
      return `const CHANGELOG_VERSIONS = [${entries}] as const;`;
    },
  );
  writeFileSync(settingsPath, src, "utf-8");
  console.log(`   ✓ src/ui/pages/SettingsPage.tsx`);
}

console.log(`\n✅ Changelog v${version} généré avec succès.\n`);
