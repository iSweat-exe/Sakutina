# 🔍 Audit Complet — Bot Discord Sakutina

## Résumé Global

**Stack :** Bun + discord.js v14 + Drizzle ORM (PostgreSQL) + i18next + winston + Canvas + TypeScript strict.

### ✅ Points Forts

| Aspect                          | Détail                                                                                                                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture modulaire**      | Séparation propre `modules/`, `services/`, `repositories/`, `core/`, `types/` — facilement extensible                                                                                                                             |
| **Services bien isolés**        | `EconomyService`, `CasinoService`, `WorkService`, `ModerationService`, `ProfileService` — la logique métier est hors des commandes                                                                                                |
| **i18n de bout en bout**        | Chaque réponse passe par `I18nService.translate()` avec locales FR/EN et `descriptionLocalizations` sur les builders                                                                                                              |
| **Sharding**                    | `ShardingManager` en place dès le départ — prêt pour le scaling                                                                                                                                                                   |
| **TypeScript strict**           | `strict: true`, `noUncheckedIndexedAccess`, types `Command`/`Event` bien définis                                                                                                                                                  |
| **Graceful shutdown**           | `SIGINT`/`SIGTERM` gérés, DB fermée, client détruit                                                                                                                                                                               |
| **Gestion des erreurs globale** | `unhandledRejection` capturé dans [bot.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/bot.ts#L54-L57), catch global dans [interactionCreate.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/events/interactionCreate.ts#L21-L37) |
| **EmbedUtils**                  | Abstraction propre des embeds avec couleurs standardisées                                                                                                                                                                         |
| **GuildConfigService + cache**  | Cache in-memory pour les settings de guild — évite des hits DB redondants                                                                                                                                                         |

### ⚠️ Faiblesses Principales

| Sévérité      | Aspect                                                | Détail                                                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 Critique   | **Sécurité — `eval` / `sql.raw`**                     | Même protégé par `DEVELOPER_ID`, `eval()` et `sql.raw()` sont des vecteurs d'exécution de code arbitraire                                                                                                                                |
| 🔴 Critique   | **Race condition — `payUser` sans transaction**       | Deux `payUser` simultanés peuvent permettre de dépenser le même solde deux fois                                                                                                                                                          |
| 🔴 Critique   | **Race condition — `addBalance` / `removeBalance`**   | Pattern read-then-write non-atomique (read balance → compute → write), vulnérable en cas d'appels concurrents                                                                                                                            |
| 🟠 Important  | **Leaderboard — full table scan**                     | `getLeaderboard()` fait `SELECT * FROM users`, trie et tranche en mémoire                                                                                                                                                                |
| 🟠 Important  | **Gestion d'erreurs par string matching**             | `error.message.startsWith("COOLDOWN:")` — fragile, pas de types d'erreur structurés                                                                                                                                                      |
| 🟠 Important  | **Code dupliqué — error handling dans les commandes** | Pattern identique dupliqué dans casino, work, pay, daily (if/else chains sur error.message)                                                                                                                                              |
| 🟠 Important  | **GuildConfigService cache**                          | Cache `Map` en mémoire sans TTL, sans invalidation, et per-shard (chaque shard a son propre cache)                                                                                                                                       |
| 🟡 Suggestion | **Pas de tests**                                      | Aucun test unitaire/intégration — aucune safety net pour les refactors                                                                                                                                                                   |
| 🟡 Suggestion | **`console.error` résiduel**                          | Utilisé dans [ModerationService.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/services/ModerationService.ts#L50) et [mod.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/moderation/commands/mod.ts) au lieu de `logger.error` |
| 🟡 Suggestion | **`uncaughtException` non géré**                      | Seul `unhandledRejection` est écouté — `uncaughtException` est ignoré                                                                                                                                                                    |

---

## 1. Architecture & Structure du Projet

### 1.1 Organisation des dossiers

```
src/
├── bot.ts              ← Client setup + start/shutdown
├── index.ts            ← Sharding entry point
├── config/env.ts       ← Env parsing + validation
├── core/               ← CommandLoader + EventLoader
├── events/             ← interactionCreate, ready
├── modules/            ← Feature modules (core, economy, fun, etc.)
│   └── <module>/commands/<command>.ts
├── repositories/       ← DB connection + Drizzle schema
├── services/           ← Business logic (separated from commands)
├── types/              ← Command + Event interfaces
├── utils/              ← Logger + EmbedUtils
├── locales/            ← i18n (en/fr)
└── scripts/deploy.ts   ← Command registration script
```

**Verdict : Bon.** Structure claire avec séparation commandes / services / repositories. Chaque module contient uniquement un dossier `commands/`. Les services sont centralisés dans `src/services/`.

### 1.2 Points d'amélioration

#### ~~🟠~~ ✅ Modules "plats" — seul `commands/` existe dans chaque module — CORRIGÉ (2026-07-28)

Chaque module sous `modules/` ne contient qu'un dossier `commands/`. Si un module a besoin de composants, de sous-handlers, ou de constantes spécifiques (ex: `AVAILABLE_JOBS` qui est dans le service), il n'y a pas de structure pour les accueillir.

> [!TIP]
> Envisager d'ajouter un `constants.ts` ou un dossier par module pour les données spécifiques :
>
> ```
> modules/economy/
> ├── commands/
> ├── constants.ts    ← AVAILABLE_JOBS, DAILY_REWARD, etc.
> └── types.ts        ← JobInfo, etc.
> ```

#### ~~🟠~~ ✅ GuildConfigService cache — pas de TTL ni d'invalidation cross-shard — CORRIGÉ (2026-07-28)

Le cache dans [GuildConfigService.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/services/GuildConfigService.ts#L17) est un simple `Map` statique. Problèmes :

1. **Aucun TTL** — les entrées ne sont jamais expirées → si la DB est modifiée manuellement, le cache est stale
2. **Per-shard** — chaque shard a sa propre instance du cache → une mise à jour dans le shard 0 n'est pas reflétée dans le shard 1
3. **Croissance illimitée** — pour un bot dans des milliers de guilds, ce `Map` grandit sans fin

#### ~~🟡~~ ✅ Manque de barrels/index files — CORRIGÉ (2026-07-28)

Pas de fichiers `index.ts` re-exportant les services ou types — les imports utilisent des chemins relatifs profonds (`../../../services/EconomyService.js`). Pas bloquant grâce aux path aliases dans `tsconfig.json`, mais ces aliases ne sont pas configurés.

---

## 2. Refactoring & Qualité du Code

### 2.1 ~~🔴~~ ✅ Race Conditions dans EconomyService — Read-Then-Write — CORRIGÉ (2026-07-28)

**Localisation :** [EconomyService.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/services/EconomyService.ts#L28-L51)

Toutes les opérations monétaires suivent le pattern :

1. Lire le solde de l'utilisateur
2. Calculer le nouveau solde en JS (`user.balance + amount`)
3. Écrire le résultat

Ce pattern est vulnérable aux race conditions : deux requêtes simultanées lisent le même solde, calculent indépendamment, et la seconde écriture écrase la première.

**Avant :**

```typescript
// EconomyService.ts — addBalance (VULNÉRABLE)
public static async addBalance(discordId: string, amount: number) {
  const user = await this.ensureUser(discordId);       // ← Read
  const updated = await db.update(users)
    .set({ balance: user.balance + amount })            // ← Compute + Write (non-atomique)
    .where(eq(users.discordId, discordId))
    .returning().then(res => res[0])!;
  return updated.balance;
}
```

**Après :**

```typescript
// EconomyService.ts — addBalance (ATOMIQUE)
public static async addBalance(discordId: string, amount: number) {
  if (amount < 0) throw new Error("Amount must be positive");
  await this.ensureUser(discordId);
  const updated = (await db.update(users)
    .set({
      balance: sql`${users.balance} + ${amount}`,   // ← Atomique en SQL
      updatedAt: new Date()
    })
    .where(eq(users.discordId, discordId))
    .returning().then(res => res[0]))!;
  return updated.balance;
}
```

Le même pattern s'applique à `removeBalance`, `claimDaily`, `workShift` et `payUser`.

### 2.2 ~~🔴~~ ✅ `payUser` sans transaction DB — CORRIGÉ (2026-07-28)

**Localisation :** [EconomyService.ts L56-L68](file:///c:/Users/iswea/Desktop/Sakutina/src/services/EconomyService.ts#L56-L68)

Le transfert d'argent fait deux opérations séquentielles sans transaction. Si la seconde échoue (crash, erreur DB), l'argent est retiré du sender mais jamais ajouté au receiver.

**Avant :**

```typescript
// DANGEREUX: pas de transaction
await this.removeBalance(senderId, amount);
await this.addBalance(receiverId, amount);
```

**Après :**

```typescript
// SÉCURISÉ: transaction SQL
public static async payUser(senderId: string, receiverId: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be positive");
  if (senderId === receiverId) throw new Error("CANNOT_PAY_SELF");

  await this.ensureUser(senderId);
  await this.ensureUser(receiverId);

  await db.transaction(async (tx) => {
    const sender = await tx.select().from(users)
      .where(eq(users.discordId, senderId))
      .then(res => res[0]);
    if (!sender || sender.balance < amount) throw new Error("INSUFFICIENT_FUNDS");

    await tx.update(users)
      .set({ balance: sql`${users.balance} - ${amount}`, updatedAt: new Date() })
      .where(eq(users.discordId, senderId));

    await tx.update(users)
      .set({ balance: sql`${users.balance} + ${amount}`, updatedAt: new Date() })
      .where(eq(users.discordId, receiverId));
  });
}
```

### 2.3 ~~🟠~~ ✅ Leaderboard — Full Table Scan — CORRIGÉ (2026-07-28)

**Localisation :** [EconomyService.ts L101-L109](file:///c:/Users/iswea/Desktop/Sakutina/src/services/EconomyService.ts#L101-L109)

```typescript
// AVANT: Charge TOUTE la table en mémoire, trie en JS
const allUsers = await db.select().from(users);
return allUsers
    .map((u) => ({ discordId: u.discordId, total: u.balance + u.bank }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
```

```typescript
// APRÈS: Tri et limite côté SQL
public static async getLeaderboard(limit: number = 10) {
  return db.select({
    discordId: users.discordId,
    total: sql<number>`${users.balance} + ${users.bank}`.as('total'),
  })
    .from(users)
    .orderBy(sql`${users.balance} + ${users.bank} DESC`)
    .limit(limit);
}
```

### 2.4 ~~🟠~~ ✅ Gestion d'erreurs par String Matching — Code Smell — CORRIGÉ (2026-07-28)

**Localisation :** Multiples fichiers (casino.ts, work.ts, pay.ts, daily.ts, EconomyService.ts, WorkService.ts)

Le pattern `throw new Error("COOLDOWN:30")` + `error.message.startsWith("COOLDOWN:")` est fragile : un typo casse silencieusement le flow, pas de complétion IDE, impossible de typer.

**Avant (work.ts) :**

```typescript
// 12 branches if/else identiques dupliquées entre work.ts et l'outer catch de casino.ts
} catch (error: any) {
  if (error.message === "JOB_NOT_FOUND") { ... }
  else if (error.message === "ALREADY_HAVE_JOB") { ... }
  else if (error.message === "INSUFFICIENT_EXPERIENCE") { ... }
  else if (error.message === "NO_JOB") { ... }
  else if (error.message === "JOB_REMOVED") { ... }
  else if (error.message.startsWith("COOLDOWN:")) { ... }
  else { ... }
}
```

**Après — Custom Error Classes :**

```typescript
// src/utils/errors.ts
export class AppError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly meta?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export class InsufficientFundsError extends AppError {
    constructor() {
        super('INSUFFICIENT_FUNDS', 'Not enough coins');
    }
}

export class CooldownError extends AppError {
    constructor(
        public readonly remaining: number,
        unit: 'seconds' | 'hours' = 'seconds'
    ) {
        super('COOLDOWN', `On cooldown`, { remaining, unit });
    }
}

export class JobError extends AppError {
    constructor(
        code:
            | 'NOT_FOUND'
            | 'ALREADY_HAVE'
            | 'NO_JOB'
            | 'REMOVED'
            | 'INSUFFICIENT_EXP'
    ) {
        super(`JOB_${code}`, `Job error: ${code}`);
    }
}
```

```typescript
// Utilisation dans un service
if (user.balance < amount) throw new InsufficientFundsError();

// Utilisation dans une commande — un seul handler
} catch (error) {
  if (error instanceof AppError) {
    const msg = I18nService.translate(`common:${error.code}`, { lng: lang, ...error.meta });
    const embed = EmbedUtils.error(msg, "Error", interaction.user);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } else {
    throw error; // rethrow vers le handler global
  }
}
```

### 2.5 ~~🟢~~ ✅ Code Dupliqué — Boilerplate lang + error dans chaque commande — CORRIGÉ (2026-07-28)

Chaque commande commence par exactement le même pattern :

```typescript
const lang = await GuildConfigService.getGuildLanguage(interaction.guildId);
```

Et se termine par un catch identique. Ce boilerplate pourrait être extrait.

**Solution :** Un wrapper ou middleware qui injecte `lang` et gère les erreurs :

```typescript
// src/utils/commandHandler.ts
export function createCommandHandler(
    handler: (
        interaction: ChatInputCommandInteraction,
        lang: string
    ) => Promise<void>
) {
    return async (interaction: ChatInputCommandInteraction) => {
        const lang = await GuildConfigService.getGuildLanguage(
            interaction.guildId
        );
        try {
            await handler(interaction, lang);
        } catch (error) {
            if (error instanceof AppError) {
                const msg = I18nService.translate(`common:${error.code}`, {
                    lng: lang,
                    ...error.meta,
                });
                const embed = EmbedUtils.error(msg, 'Error', interaction.user);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                } else {
                    await interaction.reply({
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral,
                    });
                }
            } else {
                throw error; // → re-thrown vers le handler global dans interactionCreate.ts
            }
        }
    };
}
```

### 2.6 ~~🟡~~ ✅ `console.error` résiduel au lieu de `logger.error` — CORRIGÉ (2026-07-28)

**Localisation :**

- [ModerationService.ts L50](file:///c:/Users/iswea/Desktop/Sakutina/src/services/ModerationService.ts#L50) : `console.error(...)`
- [ModerationService.ts L107](file:///c:/Users/iswea/Desktop/Sakutina/src/services/ModerationService.ts#L107) : `console.error(...)`

Devrait utiliser `logger.error()` pour cohérence et pour bénéficier du formatage winston.

### 2.7 ~~🟡~~ ✅ Non-null assertions (`!`) en cascade — CORRIGÉ (2026-07-28)

**Localisation :** Multiple fichiers (EconomyService, GuildConfigService, WorkService)

```typescript
const updated = (await db.update(users).set({...}).returning().then(res => res[0]))!;
```

Le `!` final est dangereux si la query retourne 0 rows (user supprimé entre-temps). Un `?? throw` serait plus explicite :

```typescript
const updated = await db.update(users).set({...}).returning().then(res => res[0]);
if (!updated) throw new Error("User unexpectedly disappeared during update");
```

---

## 3. Performance & Bonnes Pratiques Discord API

### 3.1 ✅ Intents minimalistes

[bot.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/bot.ts#L14) : `intents: [GatewayIntentBits.Guilds]` — excellent. Seul l'intent strictement nécessaire est demandé. Pas de `MessageContent`, pas de `GuildMembers` en passif.

### 3.2 ✅ Pas de fuite de listeners

Les event listeners sont enregistrés une seule fois via `EventLoader`. Les collectors dans les commandes ont un `time: 60000` et le `collector.on('end')` nettoie les composants. Bon pattern.

### 3.3 🟠 DB connection pool — taille fixe

[db.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/repositories/db.ts#L8) : `max: 10`. C'est un choix raisonnable mais pourrait être configurable via `env`.

### 3.4 🟡 `process.cwd()` pour construire les chemins

[bot.ts L23](file:///c:/Users/iswea/Desktop/Sakutina/src/bot.ts#L23), [deploy.ts L9](file:///c:/Users/iswea/Desktop/Sakutina/src/scripts/deploy.ts#L9) :

```typescript
const modulesPath = join(process.cwd(), 'src', 'modules');
```

`process.cwd()` dépend du répertoire de travail au lancement — potentiellement fragile. Préférer `import.meta.dir` (Bun) ou `__dirname` (Node) :

```typescript
const modulesPath = join(import.meta.dir, 'modules');
```

### 3.5 ~~🟡~~ ✅ Utilisation de `readFileSync` dans I18nService - CORRIGÉ (2026-07-28)

[I18nService.ts L6-L7](file:///c:/Users/iswea/Desktop/Sakutina/src/services/I18nService.ts#L6-L7) : `readFileSync` bloque l'event loop au démarrage. Pour un fichier lu une seule fois au boot, c'est acceptable mais pas idéal. Avec `i18next`, on peut utiliser un backend async.

---

## 4. Sécurité & Robustesse

### 4.1 🔴 `eval()` dans la commande dev

**Localisation :** [dev.ts L92-L93](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/core/commands/dev.ts#L92-L93)

```typescript
const asyncWrapper = `(async () => { return ${code}; })()`;
let result = await eval(asyncWrapper);
```

Même avec le guard `DEVELOPER_ID`, c'est un vecteur d'attaque si un compte développeur est compromis. L'`eval` a accès au scope complet : tokens, DB, `process.env`, `process.exit`, etc.

> [!CAUTION]
> **Risques :**
>
> - Accès à `env.DISCORD_TOKEN`, `env.DATABASE_URL`
> - Exécution de `process.exit()`, crash du bot
> - Exfiltration de données via des requêtes HTTP
>
> **Mitigation (si cette feature est indispensable) :**
>
> - Limiter les outputs pour éviter la fuite du token : filtrer `env` des résultats
> - Ajouter un log d'audit permanent pour chaque utilisation de `eval`
> - Envisager un sandbox (ex: `vm` module) — mais attention, `vm` n'est pas une vraie sandbox de sécurité

### 4.2 🔴 `sql.raw()` dans la commande dev

**Localisation :** [dev.ts L124](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/core/commands/dev.ts#L124)

```typescript
const result = await db.execute(sql.raw(query));
```

Permet `DROP TABLE`, `DELETE FROM users`, ou `SELECT * FROM pg_shadow` (dump des mots de passe PostgreSQL). Mêmes risques que l'eval.

### 4.3 🟠 `exec` dans la commande deploy

**Localisation :** [dev.ts L216](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/core/commands/dev.ts#L216)

```typescript
const { stdout, stderr } = await execAsync('bun run deploy');
```

Ici c'est une commande fixe, pas d'injection possible. Mais le pattern `exec` + output affiché reste sensible. OK si les seuls développeurs sont de confiance.

### 4.4 ~~🟠~~ ✅ `cleardb` utilise un mauvais nom de table - CORRIGÉ (2026-07-28)

**Localisation :** [dev.ts L204](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/core/commands/dev.ts#L204)

```typescript
await db.execute(sql`TRUNCATE TABLE users, guilds CASCADE;`);
```

La table s'appelle `guild_settings`, pas `guilds`. Cette commande échoue probablement silencieusement ou throw. De plus, la table `warns` n'est pas incluse.

**Fix :**

```typescript
await db.execute(sql`TRUNCATE TABLE users, guild_settings, warns CASCADE;`);
```

### 4.5 ✅ Validation des env au démarrage

[env.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/config/env.ts) : Throw immédiat si une variable est manquante — le bot ne démarre pas dans un état invalide. Bonne pratique.

### 4.6 ~~🟠~~ ✅ `NODE_ENV` cast non-validé - CORRIGÉ (2026-07-28)

[env.ts L28](file:///c:/Users/iswea/Desktop/Sakutina/src/config/env.ts#L28) :

```typescript
NODE_ENV: (NODE_ENV as "development" | "production") || "development",
```

Si `NODE_ENV` vaut `"staging"` ou n'importe quoi d'autre, le cast passe silencieusement. Devrait valider :

```typescript
const validEnvs = ['development', 'production'] as const;
if (NODE_ENV && !validEnvs.includes(NODE_ENV as any)) {
    throw new Error(`Invalid NODE_ENV: ${NODE_ENV}`);
}
```

### 4.7 ~~🟡~~ ✅ Pas de handler `uncaughtException` - CORRIGÉ (2026-07-28)

[bot.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/bot.ts#L54-L57) gère `unhandledRejection` mais pas `uncaughtException`. Un throw non capturé dans du code synchrone crash le process silencieusement.

```typescript
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    // Optionnel: graceful shutdown
});
```

### 4.8 ~~🟡~~ ✅ Pas de validation du `duration` dans la commande mute - CORRIGÉ (2026-07-28)

[mod.ts L220](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/moderation/commands/mod.ts#L220) : La durée du mute n'a pas de limite max côté builder. Discord limite les timeouts à 28 jours (40320 minutes). Un admin pourrait passer `999999`.

```typescript
.setMinValue(1)
.setMaxValue(40320) // 28 jours max selon Discord API
```

### 4.9 🟡 Logger — pas de transport fichier en production

[logger.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/utils/logger.ts) : Uniquement `Console` transport. En production, les logs sont perdus au restart. Ajouter un `File` transport serait sage pour les audits/debug.

---

## 5. Actions de Refactoring Priorisées

### 🔴 URGENT (Bugs / Sécurité / Intégrité des données)

| #   | Action                                                                                                 | Fichier(s)                                                                                                                                                                         | Impact                                              |
| --- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1   | **Rendre les opérations monétaires atomiques** — utiliser `sql` expressions au lieu de read-then-write | [EconomyService.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/services/EconomyService.ts), [WorkService.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/services/WorkService.ts) | Empêche la duplication d'argent                     |
| 2   | **Wrapper `payUser` dans une transaction DB**                                                          | [EconomyService.ts L56-L68](file:///c:/Users/iswea/Desktop/Sakutina/src/services/EconomyService.ts#L56-L68)                                                                        | Empêche la perte d'argent en cas d'erreur           |
| 3   | **Fixer `cleardb` — mauvais nom de table**                                                             | [dev.ts L204](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/core/commands/dev.ts#L204)                                                                                       | Bug fonctionnel — la commande ne fait rien ou crash |
| 4   | **Remplacer `console.error` par `logger.error`**                                                       | [ModerationService.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/services/ModerationService.ts) L50, L107                                                                        | Logs manquants en production                        |
| 5   | **Ajouter `uncaughtException` handler**                                                                | [bot.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/bot.ts)                                                                                                                       | Crash silencieux sans logs                          |

### 🟠 RECOMMANDÉ (Qualité / Maintenabilité / Performance)

| #   | Action                                                                            | Fichier(s)                                                                                                                               | Impact                             |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 6   | **Refactorer `getLeaderboard` — SQL ORDER BY + LIMIT**                            | [EconomyService.ts L101-L109](file:///c:/Users/iswea/Desktop/Sakutina/src/services/EconomyService.ts#L101-L109)                          | Performance (O(n) → O(1) côté app) |
| 7   | **Créer des classes d'erreur typées** — remplacer les `throw new Error("STRING")` | Tous les services + commandes                                                                                                            | Typage, IDE, maintenabilité        |
| 8   | **Extraire un `commandHandler` wrapper** — factoriser lang + error handling       | Toutes les commandes                                                                                                                     | DRY, réduction du boilerplate      |
| 9   | **Ajouter un TTL au GuildConfigService cache**                                    | [GuildConfigService.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/services/GuildConfigService.ts)                                      | Cache stale prevention             |
| 10  | **Remplacer les `!` non-null assertions par des checks explicites**               | Multiples services                                                                                                                       | Robustesse, debugging plus clair   |
| 11  | **Valider `NODE_ENV` au lieu de le caster**                                       | [env.ts L28](file:///c:/Users/iswea/Desktop/Sakutina/src/config/env.ts#L28)                                                              | Détection de mauvaise config       |
| 12  | **Ajouter `.setMaxValue(40320)` au duration du mute**                             | [mod.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/moderation/commands/mod.ts)                                                 | Conformité Discord API             |
| 13  | **Utiliser `import.meta.dir` au lieu de `process.cwd()`**                         | [bot.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/bot.ts), [deploy.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/scripts/deploy.ts) | Robustesse du chemin               |

### 🟡 OPTIONNEL (Polish / Bonnes pratiques)

| #   | Action                                                                      | Fichier(s)                                                                            | Impact                             |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------- |
| 14  | **Ajouter un transport fichier au logger**                                  | [logger.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/utils/logger.ts)              | Persistance des logs en production |
| 15  | **Ajouter des path aliases dans tsconfig**                                  | [tsconfig.json](file:///c:/Users/iswea/Desktop/Sakutina/tsconfig.json)                | DX — éviter `../../../`            |
| 16  | **Introduire un framework de tests (vitest)**                               | Nouveau fichier                                                                       | Safety net pour les refactors      |
| 17  | **Ajouter un linter (eslint)**                                              | Nouveau fichier                                                                       | Cohérence du code                  |
| 18  | **Mettre le pool size DB dans les env vars**                                | [db.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/repositories/db.ts)               | Configurabilité                    |
| 19  | **Sécuriser la commande eval** — filtrer les outputs sensibles, log d'audit | [dev.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/modules/core/commands/dev.ts)    | Sécurité en profondeur             |
| 20  | **Utiliser `i18next` backend async** au lieu de `readFileSync`              | [I18nService.ts](file:///c:/Users/iswea/Desktop/Sakutina/src/services/I18nService.ts) | Non-blocking IO au boot            |

---

## 6. Métriques du Code

| Métrique                   | Valeur                           |
| -------------------------- | -------------------------------- |
| Fichiers source TypeScript | ~25                              |
| Commandes slash            | 12                               |
| Services                   | 8                                |
| Tables DB                  | 3 (users, guild_settings, warns) |
| Langues i18n               | 2 (en, fr)                       |
| Clés de traduction         | ~106 par langue                  |
| Tests                      | 0 ❌                             |
| Lignes de code (estimé)    | ~2 200                           |

---

## 7. Conclusion

Le projet est **bien structuré pour un bot de cette taille**. L'architecture modules/services/repositories est propre, l'i18n est intégrée de bout en bout, et le TypeScript strict est un bon choix. Les préoccupations principales sont :

1. **L'intégrité des données** — les opérations monétaires ne sont pas atomiques et `payUser` n'utilise pas de transaction. C'est le point le plus critique à corriger.
2. **La gestion d'erreurs** — le pattern string-matching est fragile et génère beaucoup de duplication. Des classes d'erreur typées simplifieraient drastiquement le code.
3. **Un bug concret** — la commande `cleardb` référence une table `guilds` qui n'existe pas.

Le reste sont des améliorations de qualité qui rendront le code plus maintenable à mesure que le bot grandit.
