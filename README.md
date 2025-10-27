# Projet Shiller Trainer

Application web pour simuler l'interface du défibrillateur **DEFIGARD Touch 7** et permettre aux formateurs sapeurs-pompiers de piloter les constantes vitales en temps réel.

## Structure du dépôt
```
docs/             Documentation fonctionnelle et technique
server/           API Express + Socket.IO + PostgreSQL
client-admin/     Interface formateur (Vue 3)
client-shiller/   Interface apprenant (Vue 3)
```

## Prochaines étapes déjà réalisées
- Initialisation du serveur Express et configuration Socket.IO ✅
- Interfaces Vue (admin et shiller) avec mise à jour temps réel ✅
- Persistance PostgreSQL (migrations + refactor backend) ✅

## Démarrage rapide (serveur)
```bash
cd server
npm install
cp .env.example .env   # adapter si besoin
npm run migrate:up
npm run dev
```

Identifiants de démonstration (générés au démarrage si absents) :
- email : `formateur@demo.fr`
- mot de passe : `demo123`

## Interface admin (développement)
```bash
cd client-admin
npm install
npm run dev
```

L'admin consomme l'API sur `http://localhost:4000`. Crée une session, sélectionne-la puis ajuste les constantes pour envoyer les valeurs en direct.

## Interface apprenant
```bash
cd client-shiller
npm install
npm run dev
```

Entre le code de session pour afficher les constantes en temps réel dans un écran inspiré du Touch 7. Les alertes passent en rouge quand les valeurs sortent des bornes.

## Persistance PostgreSQL
Le backend lit et écrit dans PostgreSQL via `pg`. Migrations disponibles dans `server/migrations/`.

### Mise en place locale rapide
1. Lancer Postgres (exemple Docker) :
   ```bash
   docker run --name shiller-db \
     -e POSTGRES_USER=shiller \
     -e POSTGRES_PASSWORD=shiller \
     -e POSTGRES_DB=shiller_dev \
     -p 5432:5432 -d postgres:15
   ```
2. Copier `.env.example` vers `.env` et vérifier les variables (`PGUSER`, `PGPASSWORD`, `PGDATABASE`, `PGHOST`, `PGPORT`, `PGSSL`, `DEMO_TRAINER_*`).
3. Appliquer les migrations :
   ```bash
   cd server
   npm run migrate:up
   ```
4. Lancer le serveur (`npm run dev`). Les sessions, événements et comptes formateurs sont désormais stockés dans la base.

## Déploiement gratuit (proposition)
- **Backend + DB** : Fly.io  
  1. Installer la CLI : <https://fly.io/docs/hands-on/install-flyctl>  
  2. `cd server`  
  3. `fly launch --copy-config --no-deploy` (réutilise `fly.toml`)  
  4. Créer une base gérée : `fly postgres create --name shiller-pg --initial-cluster-size 1 --vm-size shared-cpu-1x`  
  5. Attacher la base : `fly postgres attach --postgres-app shiller-pg` (génère `DATABASE_URL`)  
  6. Déployer : `fly deploy` (exécute `npm run migrate:up` via `release_command`)  
  7. L'app peut tourner sans frais en laissant `min_machines_running = 0` (démarrage à la demande).

- **Interfaces statiques** : Netlify, Vercel ou Cloudflare Pages  
  - Pour chaque front :
    ```bash
    cd client-admin
    npm install
    npm run build  # dossier dist/ à publier
    ```
  - Même commande pour `client-shiller`.

- **Automatisation (optionnel)** : connecter le repo GitHub à Fly (GitHub Action qui lance `fly deploy`) et à Netlify/Vercel pour rebuild automatique.

## Références
- Spécification fonctionnelle : `docs/functional-spec.md`
- Plan persistance : `docs/persistence-plan.md`
