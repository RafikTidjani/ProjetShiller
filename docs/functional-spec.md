# Projet Simulateur DEFIGARD – Spécification Fonctionnelle (MVP)

## 1. Objectifs
- Former les apprenants sapeurs-pompiers à l’interprétation des constantes affichées sur un DEFIGARD Touch 7 simulé.
- Permettre à un formateur de piloter en temps réel les valeurs de **tension**, **fréquence cardiaque** et **SpO₂** pour un appareil simulé.
- Offrir un accès multi-formateur avec sessions temporaires accessibles via un code.

## 2. Rôles et parcours utilisateur
### Formateur
1. Se connecter (identifiant + mot de passe).
2. Créer une session (génération automatique d’un code 6 chiffres).
3. Confirmer que la session expire automatiquement après **1 heure**.
4. Ajuster en temps réel les constantes via l’interface admin (champs numériques + boutons ±).
5. Clore manuellement la session ou la laisser expirer.

### Apprenant
1. Saisir le code de session sur l’interface « Shiller ».
2. Visualiser instantanément les valeurs envoyées par le formateur (mise à jour en temps réel).
3. Percevoir des alertes visuelles si les valeurs sortent des plages réalistes (sons ajoutés plus tard).

## 3. Architecture applicative (MVP)
- **Frontend** : deux applications Vue 3 (Vite) – `admin` et `shiller`.
- **Backend** : Express (JavaScript), API REST + Socket.IO pour la diffusion temps réel.
- **Base de données** : PostgreSQL (hébergée localement pour le développement) afin de stocker :
  - formateurs (email, mot de passe hashé avec bcrypt),
  - sessions (code, formateur, date début/fin, état),
  - historiques de valeurs (timestamp, valeurs envoyées) – stockage minimal au début (optionnel).
- **Communication** :
  - REST pour l’authentification, la création et la fermeture des sessions.
  - Socket.IO pour synchroniser les valeurs vitales entre admin(s) et interface(s) Shiller.
- **Expiration** : tâche planifiée côté serveur qui supprime/expire une session au bout de 60 minutes.
- **Sécurité** : authentification simple par en-tête Bearer JWT (accès admin). Les routes publiques `/sessions/join` n’exigent pas de JWT mais vérifient le code.

## 4. Modèle de données
```mermaid
erDiagram
    TRAINER {
        uuid id PK
        string email UNIQUE
        string passwordHash
        timestamptz createdAt
        timestamptz updatedAt
    }

    SESSION {
        uuid id PK
        uuid trainerId FK
        string code UNIQUE
        timestamptz createdAt
        timestamptz expiresAt
        timestamptz closedAt NULL
        jsonb lastValues
    }

    VALUE_EVENT {
        uuid id PK
        uuid sessionId FK
        integer systolic
        integer diastolic
        integer heartRate
        integer spo2
        timestamptz createdAt
    }

    TRAINER ||--o{ SESSION : "crée"
    SESSION ||--o{ VALUE_EVENT : "reçoit"
```

## 5. Bornes et validations
- **Tension systolique** : 40 – 260 mmHg (alerte visuelle > 220 ou < 70).
- **Tension diastolique** : 20 – 180 mmHg (alerte visuelle > 120 ou < 40).
- **Fréquence cardiaque** : 20 – 220 bpm (alerte > 180 ou < 40).
- **SpO₂** : 40 – 100 % (alerte < 85 %).
- L’admin peut saisir toute valeur ; si hors plage réaliste, une bannière rouge s’affiche côté admin & shiller avec un indicateur « hors plage ».

## 6. API (version initiale)

| Méthode | Endpoint | Description | Auth |
|---------|----------|-------------|------|
| `POST` | `/api/auth/login` | Authentifie un formateur (email, mot de passe) et renvoie un JWT + durée | Public |
| `GET` | `/api/whoami` | Renvoie les infos formateur | JWT |
| `POST` | `/api/sessions` | Crée une session (code, expireAt) | JWT |
| `GET` | `/api/sessions` | Liste les sessions actives du formateur | JWT |
| `DELETE` | `/api/sessions/:id` | Clôture la session (met closedAt) | JWT |
| `POST` | `/api/sessions/:id/values` | Met à jour les valeurs en base et diffuse sur Socket.IO | JWT |
| `POST` | `/api/public/session-join` | Vérifie un code de session et renvoie l’ID + métadonnées | Public |

### Socket.IO
- Namespace : `/sessions`.
- Événements :
  - `join-session` (payload `{ sessionCode }`) : permet au shiller ou à l’admin secondaire de rejoindre une room.
  - `session-values` (payload `{ systolic, diastolic, heartRate, spo2, timestamp, outOfRangeFlags }`) : diffusé par le serveur à toutes les rooms.
  - `session-expired` : avertit les clients que la session est terminée.

## 7. Interfaces (wireframe rapide)
### Admin
- Header : code session visible, bouton « Terminer ».
- Section valeurs :
  - Cartes pour `Tension`, `Fréquence cardiaque`, `SpO₂`.
  - Chaque carte : champ numérique, boutons `-5`, `-1`, `+1`, `+5`.
  - Indicateur couleur (vert/orange/rouge) selon plage.
- Statut temps réel : pastille verte « connecté » quand Socket.IO actif.

### Shiller
- Layout inspiré de la capture fournie :
  - Bande supérieure noire (heure, icônes factices).
  - Bloc central violet : fréquence cardiaque en gros (valeur + icône cœur).
  - Bloc droit bleu : SpO₂.
  - Bloc inférieur gauche gris : tension (SYS/DIA + MAP calculée).
  - Bloc inférieur droit bleu foncé : placeholder pour valeurs futures (température, etc.).
  - Banners rouges en haut si alerte.

## 8. Session lifecycle
1. Création session → code aléatoire 6 chiffres (unique, stocké).
2. Formateur partage le code.
3. Apprenant se connecte (page Shiller) → joint la session via API public + Socket.
4. Formateur ajuste les valeurs → REST `values` + diffusion.
5. Si expiration ou fermeture : Socket `session-expired` + redirection interface shiller sur page « Session terminée ».
6. Nettoyage automatique : job toutes les minutes supprime les sessions expirées (et leurs events).

## 9. Roadmap future
- Ajout scénarios préconfigurés (hypoxie, arrêt cardio-respiratoire…).
- Enregistrement/replay des séquences.
- Ajout d’autres paramètres (température, rythme respiratoire).
- Sons d’alarme, mode multi-appareils, exports CSV.
- Passage à TypeScript + tests automatisés (Jest/Vitest, Cypress).

---
_Version : 0.1 – 2024-XX-XX_
