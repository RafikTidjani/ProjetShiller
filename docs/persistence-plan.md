# Persistance Projet Shiller (PostgreSQL)

Objectif : remplacer le stockage en mémoire par une base PostgreSQL et structurer les données pour préparer l'évolution (historique, multi-formateur, audit). Cette note décrit la stratégie adoptée. ✅ Migration initiale et refactor backend réalisés (sessions/événements en base).

## 1. Choix techniques
- **Base** : PostgreSQL 15+ (compatible avec services cloud et Docker). 
- **Accès Node** : `pg` + `pg-pool` (simples, sans ORM au départ). Possibilité future de passer à Prisma/Drizzle si besoin.
- **Gestion migrations** : utiliser `node-pg-migrate` (scripts Node). Chaque migration versionne la structure.
- **Variables d'environnement** : `DATABASE_URL`, `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGPORT`, `PGDATABASE`, `PGSSL` selon contexte. On fournira un `.env.example`.

## 2. Modèle de données
```mermaid
erDiagram
    trainers {
        uuid id PK
        text email UNIQUE
        text password_hash
        timestamptz created_at
        timestamptz updated_at
    }

    sessions {
        uuid id PK
        uuid trainer_id FK
        varchar(6) code UNIQUE
        text trainee_name
        timestamptz created_at
        timestamptz expires_at
        timestamptz closed_at
        jsonb last_values
    }

    session_events {
        uuid id PK
        uuid session_id FK
        integer systolic
        integer diastolic
        integer heart_rate
        integer spo2
        jsonb flags
        timestamptz created_at
    }

    trainers ||--o{ sessions : "crée"
    sessions ||--o{ session_events : "diffuse"
```

> `last_values` garde la dernière mesure pour éviter un `JOIN` coûteux. Les mesures détaillées iront dans `session_events`. 

## 3. Migrations prévues
1. **0001_init** : création des tables `trainers`, `sessions`, `session_events`. Index sur `sessions.code`, `sessions.expires_at`.
2. **0002_seed_demo_trainer** : insertion du formateur de démo (optionnel en dev).
3. **0003_add_indexes** : si besoin, index sur `session_events.created_at` pour analytics.

## 4. Adaptations backend
### 4.1 Configuration
- Nouveau module `server/src/db/pool.js` pour initialiser `pg.Pool` (gestion connexions).
- Utiliser `dotenv` pour charger `DATABASE_URL` si présent.

### 4.2 Requêtes (remplacement Map in-memory)
- `authenticate` → requête `SELECT id, password_hash FROM trainers WHERE email = $1`. (En attendant, hash stocké en clair ou bcrypt).
- `create session` → `INSERT INTO sessions (...) RETURNING *`. Le code unique est vérifié en DB (`UNIQUE` + tentative répétée si conflit).
- `list sessions` → `SELECT * FROM sessions WHERE trainer_id = $1 ORDER BY created_at DESC` + jointure éventuelle pour compte d'événements.
- `update values` → `UPDATE sessions SET last_values = $1 WHERE id = $2` + `INSERT INTO session_events`. Les notifications Socket.IO restent identiques.
- `close session` → `UPDATE sessions SET closed_at = NOW()`; plus besoin de manipuler Map.
- `join session` → `SELECT * FROM sessions WHERE code = $1 AND closed_at IS NULL AND expires_at > NOW()`.
- Job d'expiration → requête `UPDATE sessions SET closed_at = NOW() WHERE closed_at IS NULL AND expires_at <= NOW() RETURNING id, code` pour informer les sockets.

### 4.3 Gestion Token
- Maintenir `activeTokens` en mémoire pour MVP (plus simple). 
- Plus tard : table `trainer_tokens` ou passer à JWT signé.

## 5. Étapes d'intégration
1. Ajouter dépendances `pg` et `node-pg-migrate` + scripts npm (`migrate up`, `migrate down`).
2. Créer structure `server/src/db/` (pool + helpers).
3. Écrire migration initiale et script de seed.
4. Refactoriser `server/src/index.js` pour utiliser la DB (remplacer Maps par requêtes). Garder tests de base (création session, join…).
5. Ajuster stores front si réponses API changent (format identique -> pas de changement).
6. Documenter (`README`) comment lancer PostgreSQL (Docker `docker run` ou `docker-compose` minimal).

## 6. Mode développement rapide
- Fournir un `docker-compose.yml` (optionnel) :
  ```yaml
  services:
    db:
      image: postgres:15
      environment:
        POSTGRES_USER: shiller
        POSTGRES_PASSWORD: shiller
        POSTGRES_DB: shiller_dev
      ports:
        - "5432:5432"
      volumes:
        - pgdata:/var/lib/postgresql/data
  volumes:
    pgdata:
  ```
- Ajouter dans README : `npm run migrate:up` pour initialiser.

## 7. Transition douce
- Garder le stockage en mémoire en secours via un drapeau (`USE_IN_MEMORY=true`) pour tests rapides si la DB n'est pas dispo.
- Écrire un module `repositories/sessionRepository.js` qui propose deux implémentations (`db` vs `memory`) contrôlées par une variable d'environnement. Cela facilite les tests et la rétrocompatibilité.

## 8. Sécurité & futur
- Prévoir cryptage des mots de passe (`bcrypt`) lors de la migration. 
- Ajouter champs `updated_at` avec `DEFAULT NOW()` + trigger `ON UPDATE NOW()` pour audit. 
- Prévoir extension future : `trainers` multi-écoles, `session_templates`, `alerts`.

---
**Prochaine action** : ajouter les dépendances `pg`, `node-pg-migrate`, puis créer le module `db/pool.js` et la première migration.
