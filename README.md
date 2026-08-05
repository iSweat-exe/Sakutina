# Sakutina

Bot Discord tout-en-un : économie, casino, modération, quêtes, interactions et plus, avec support multilingue (FR/EN) et multi-serveur natif.

**Stack :** [Bun](https://bun.sh) + TypeScript (strict) + [discord.js](https://discord.js.org) v14 + [Drizzle ORM](https://orm.drizzle.team) (PostgreSQL) + [i18next](https://www.i18next.com) + [winston](https://github.com/winstonjs/winston)

## Fonctionnalités

- **Économie** — portefeuille/banque, virements, vol (`/rob`), récompense journalière, système de métiers avec paliers d'XP, historique des transactions
- **Casino** — quitte ou double, pile ou face, pierre-papier-ciseaux, machine à sous
- **Quêtes** — objectifs quotidiens/hebdomadaires générés automatiquement, récompenses en pièces
- **Classement** — leaderboard des utilisateurs les plus riches par serveur
- **Modération** — avertissements avec auto-ban configurable, mute/kick/ban/softban, logs dédiés, historique par utilisateur, synchronisation des bans natifs Discord
- **Profil** — niveau, XP, statistiques économiques et casino en un coup d'œil
- **Interactions** — plus de 20 actions sociales (hug, pat, kiss, ...) avec GIFs et compteurs persistants
- **Rappels** — `/remindme`, livré en DM ou dans le salon d'origine
- **Événements aléatoires** — apparitions ponctuelles dans les salons configurés, à réclamer avant expiration
- **Configuration par serveur** — langue, salon de logs de modération, seuil d'auto-ban, salons d'événements
- **Outils développeur** — `/dev` (eval, SQL brut, stats bot/système, purge DB) restreint par `DEVELOPER_ID`
- **i18n complet** — toutes les réponses et toutes les commandes slash sont localisées (FR/EN)
- **Sharding** — démarrage via `ShardingManager`, prêt à scaler sur plusieurs process

## Prérequis

- [Bun](https://bun.sh) ≥ 1.3
- Une base PostgreSQL (locale, Docker ou hébergée type Supabase)
- Une application Discord avec un bot créé sur le [Discord Developer Portal](https://discord.com/developers/applications)

## Installation

```bash
bun install
cp .env.example .env.local
```

Renseigne `.env.local` :

| Variable         | Description                                                   |
| ---------------- | ------------------------------------------------------------- |
| `DISCORD_TOKEN`  | Token du bot                                                  |
| `CLIENT_ID`      | ID de l'application Discord                                   |
| `DEVELOPER_ID`   | ID(s) Discord autorisés pour `/dev`, séparés par des virgules |
| `DATABASE_URL`   | Chaîne de connexion PostgreSQL                                |
| `NODE_ENV`       | `development` ou `production`                                 |
| `OPENAI_API_KEY` | Optionnel — active `/ask`                                     |

## Base de données

Le schéma est défini dans [src/repositories/schema.ts](src/repositories/schema.ts) avec [Drizzle ORM](https://orm.drizzle.team) ; les migrations SQL versionnées vivent dans [drizzle/](drizzle).

```bash
bun run db:generate   # génère une migration à partir des changements du schéma
bun run db:push       # applique le schéma directement (pratique en dev)
bun run db:studio     # explorateur de données Drizzle Studio
```

> [!WARNING]
> La migration [`0005_red_retro_girl.sql`](drizzle/0005_red_retro_girl.sql) ajoute la colonne `guild_id` en `NOT NULL` sur `users` (passage d'une économie mono-serveur à une économie par serveur). Si ta base contient déjà des lignes `users` d'avant cette migration, l'`ALTER TABLE` échouera faute de valeur par défaut. Sur une base fraîche ou de test, `db:push`/les migrations s'appliquent sans souci. Sur une base avec des données existantes, fais un backfill manuel de `guild_id` (ou repars d'une base vide) avant d'appliquer cette migration.

## Lancer le bot

```bash
bun run dev      # mode développement (hot reload)
bun run deploy   # enregistre/actualise les commandes slash auprès de Discord
bun run start    # mode production
```

`deploy` est à relancer à chaque ajout/modification de commande. Le bot planifie aussi automatiquement quatre tâches de fond au démarrage (voir [Tâches planifiées](#tâches-planifiées)).

## Scripts disponibles

| Commande              | Description                                |
| --------------------- | ------------------------------------------ |
| `bun run dev`         | Démarre le bot avec rechargement à chaud   |
| `bun run start`       | Démarre le bot en production               |
| `bun run deploy`      | Déploie les slash commands sur Discord     |
| `bun run typecheck`   | Vérifie les types (`tsc --noEmit`, strict) |
| `bun run lint`        | Vérifie le formatage (Prettier)            |
| `bun run format`      | Reformate le code (Prettier)               |
| `bun run db:generate` | Génère une migration Drizzle               |
| `bun run db:push`     | Applique le schéma directement à la base   |
| `bun run db:studio`   | Ouvre Drizzle Studio                       |

## Docker

```bash
docker compose up --build
```

`docker-compose.yml` fournit un service `postgres` prêt à l'emploi en local. En production, adapte `DATABASE_URL` et fournis `.env.production.local`. L'image se construit en plusieurs étapes (dépendances de prod isolées des dépendances de dev) pour rester légère.

## Architecture

```
src/
├── bot.ts                 # Client Discord + démarrage/arrêt propre
├── index.ts                # Point d'entrée du ShardingManager
├── config/env.ts            # Chargement et validation des variables d'env
├── core/                    # CommandLoader + EventLoader (chargement dynamique)
├── events/                  # Handlers d'événements Discord (interactionCreate, ready, ...)
├── jobs/                    # Tâches planifiées (cron)
├── modules/
│   └── <module>/commands/    # Une commande slash = un fichier, groupé par domaine
├── repositories/             # Connexion DB + schéma Drizzle
├── services/                 # Logique métier, découplée des commandes
├── locales/{en,fr}/          # Fichiers de traduction i18next, par namespace
├── types/                    # Interfaces Command / Event
└── utils/                    # Logger, embeds, gestion d'erreurs typées, wrapper de commande
```

Chaque commande est un module autonome exportant un objet `{ data, execute, autocomplete? }` (voir [src/types/Command.ts](src/types/Command.ts)), chargé automatiquement par le [`CommandLoader`](src/core/CommandLoader.ts) — il suffit d'ajouter un fichier dans `modules/<domaine>/commands/` pour qu'une nouvelle commande soit prise en compte.

La logique métier (transactions, cooldowns, calculs) vit exclusivement dans `services/`, jamais dans les commandes elles-mêmes. Les erreurs métier utilisent des classes typées ([`src/utils/errors.ts`](src/utils/errors.ts)) plutôt que du string-matching, et [`createCommandHandler`](src/utils/commandHandler.ts) factorise la récupération de la langue du serveur ainsi que la conversion des erreurs en réponses localisées.

## Tâches planifiées

| Job                     | Fréquence          | Rôle                                                    |
| ----------------------- | ------------------ | ------------------------------------------------------- |
| `BankInterestJob`       | Tous les jours     | +1% d'intérêts sur les comptes bancaires                |
| `ReminderJob`           | Toutes les minutes | Envoie les rappels arrivés à échéance                   |
| `QuestResetJob`         | Quotidien/hebdo    | Régénère les quêtes journalières et hebdomadaires       |
| `TransactionCleanupJob` | Tous les jours     | Purge l'historique des transactions de plus de 14 jours |

## Internationalisation

Les traductions sont réparties par namespace (`common`, `economy`, `fun`, `mod`, `users`) sous [src/locales/{en,fr}](src/locales/en). Chaque commande slash déclare aussi ses propres `nameLocalizations`/`descriptionLocalizations` pour que Discord affiche les noms de commandes traduits dans le client. La langue effective d'un serveur est mise en cache en mémoire (TTL 5 min) par [`GuildConfigService`](src/services/GuildConfigService.ts) et configurable via `/config language`.

## Contribuer

```bash
bun run typecheck   # aucune erreur de type tolérée (strict + noUnusedLocals/Parameters)
bun run lint         # le code doit être formaté avec Prettier avant commit
```

La CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) vérifie ces deux points sur chaque push/PR vers `main`.
