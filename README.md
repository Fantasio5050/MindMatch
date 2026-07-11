# MindMatch 🧠

MindMatch est une application de personnalité entre amis. Créez un groupe, partagez un code, répondez chacun à un questionnaire de 36 questions, puis découvrez votre profil de personnalité, comparez-vous à vos amis et débattez de vos plus grandes différences.

Tout fonctionne en local (localStorage) — aucun serveur requis pour ce MVP.

## Fonctionnalités

- **Accueil** — créer un groupe ou en rejoindre un avec un code, choix du pseudo.
- **Questionnaire** — 36 questions (personnalité, valeurs, dilemmes, préférences), cartes animées et barre de progression.
- **Profil** — archétype de personnalité, description personnalisée, radar chart et jauges sur 7 traits (créativité, logique, ambition, empathie, indépendance, sociabilité, organisation).
- **Groupe** — radar comparatif, points communs, plus grandes différences, classements amusants (le/la plus créatif·ve, organisé·e, aventurier·ère, empathique, ambitieux·se, sociable, stratège, indépendant·e).
- **Débats** — sujets de débat générés automatiquement à partir des plus grands écarts de personnalité entre membres du groupe.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- Framer Motion (animations)
- React Router (HashRouter)
- Zustand (state + persistance localStorage)

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrez l'URL affichée sur votre téléphone ou votre navigateur (l'interface est conçue mobile-first).

## Build

```bash
npm run build
npm run preview
```
