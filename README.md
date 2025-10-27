# Projet Shiller Trainer

Application web pour simuler l'interface du défibrillateur **DEFIGARD Touch 7** et permettre aux formateurs sapeurs-pompiers de piloter les constantes vitales en temps réel.

## Structure du dépôt
```
docs/             Documentation fonctionnelle et technique
server/           API Express + Socket.IO (JavaScript)
client-admin/     Interface formateur (Vue 3)
client-shiller/   Interface apprenant, look & feel DEFIGARD (Vue 3)
```

## Prochaines étapes
- Initialisation du serveur Express (structure `src/`, config env). ✅
- Creation des projets Vue via Vite pour les interfaces admin et shiller.
- Implémentation des websockets et de la logique de session.
- Plannification de la persistance PostgreSQL (`docs/persistence-plan.md`). ✅

## Démarrage rapide (serveur)
```bash
cd server
npm install
npm run dev
```

Identifiants de démonstration (provisoires) :
- email : `formateur@demo.fr`
- mot de passe : `demo123`

## Interface admin (développement)
```bash
cd client-admin
npm install
npm run dev
```

Par défaut l’admin consomme l’API sur `http://localhost:4000`. Crée une session, sélectionne-la puis ajuste les constantes : les valeurs sont envoyées au backend et diffusées en temps réel via Socket.IO.

## Interface apprenant
```bash
cd client-shiller
npm install
npm run dev
```

Renseigne le code session communiqué par le formateur pour afficher les constantes en temps réel avec un look proche du DEFIGARD Touch 7. Le panneau réagit aux alertes (plages hors bornes) et se déconnecte automatiquement lorsque la session expire.

## Persistance PostgreSQL (en préparation)
Le stockage est encore en mémoire. Le plan d’intégration PostgreSQL + migrations se trouve dans `docs/persistence-plan.md`. Prochaine étape : ajouter les dépendances (`pg`, `node-pg-migrate`), écrire le module `server/src/db/pool.js` et la migration `0001_init`.

### Mise en place locale rapide
1. Lancer Postgres (ex. via Docker) :
   ```bash
   docker run --name shiller-db -e POSTGRES_USER=shiller -e POSTGRES_PASSWORD=shiller -e POSTGRES_DB=shiller_dev -p 5432:5432 -d postgres:15
   ```
2. Configurer les variables d’environnement (`.env`) :
   ```
   PGUSER=shiller
   PGPASSWORD=shiller
   PGDATABASE=shiller_dev
   PGHOST=127.0.0.1
   PGPORT=5432
   ```
3. Appliquer la migration :
   ```bash
   cd server
   npm install
   npm run migrate:up
   ```
4. Le serveur utilisera automatiquement la base via `pg.Pool`. (La logique API est encore branchée sur l’in-memory ; la prochaine étape est de remplacer les Maps par des requêtes SQL.)

_Voir `docs/functional-spec.md` pour le détail fonctionnel._
