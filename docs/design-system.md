# Design system — « Le Cercle électrique »

Référence de la refonte UX/UI. Source de vérité technique : **`src/styles/tokens.css`**.

## Le pitch

> MindMatch n'est pas une app qu'on ouvre. C'est un jeu qu'on sort de sa boîte.

Table de jeu premium (noir chaud, feutre, liserés) **+** plateau télé (typo condensée, révélations).
Deux surfaces, deux langages, une seule identité.

## 5 principes

1. **Le téléphone se tait, la TV parle.** Le téléphone est calme et fonctionnel (ta main, ton secret, ton action). Couleur, mouvement et spectacle vivent sur la TV. *Calme ≠ mort : le téléphone montre toujours ce qui se passe dans la pièce (qui a voté, qui parle).*
2. **Personne ne lit.** Plafond dur : **6 mots** pour une instruction en jeu sur téléphone. Les règles longues n'existent qu'en phase d'intro, sur la TV, une fois.
3. **Le groupe est le sujet, l'interface est le décor.** Les visages sont les plus gros objets à l'écran.
4. **Une révélation se mérite.** Tout moment de vérité : suspension → bascule → verdict. Jamais d'apparition instantanée.
5. **Une seule couleur a le droit de crier.** `spark`. Le reste est neutre. La couleur signale, elle ne décore pas.

### Le test de validation
> « Est-ce que ça améliore une soirée réelle avec 8 personnes dans une pièce sombre ? »

Si non, on ne le fait pas — même si c'est « plus moderne ».

## Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `ink` | `#0C0B10` | Fond. Noir **chaud**, jamais violet. |
| `felt` | `#17151E` | La table, les cartes au repos. |
| `felt-raised` | `#221F2B` | Élévation réelle (rare). |
| `felt-sunken` | `#100E15` | Creux, zones inertes. |
| **`spark`** | **`#FF3D7F`** | **La signature.** Action principale, focus, tension. |
| `brass` | `#D9A441` | Victoire, hôte, XP. **Accent seulement** — s'il domine, l'app vire casino. |
| `blood` | `#C1272D` | 18+, danger, élimination. |
| `jade` | `#3FB08A` | Présence, validation. Discret. |
| `chalk` | `#F2EFE9` | Texte. Blanc cassé, jamais blanc pur. |
| `line` / `line-strong` | chalk 10 % / 18 % | Liserés — **remplacent le glassmorphism**. |

**Hiérarchie de texte : 4 niveaux et rien d'autre** — `chalk` · `chalk-muted` (72 %) · `chalk-soft` (48 %) · `chalk-faint` (32 %).
*(L'audit avait relevé 14 opacités différentes : c'est ce qui rendait la hiérarchie floue partout.)*

## Typographie

- **`--font-display`** — Archivo Variable (axes chasse 62-125 + graisse 100-900). Un seul fichier sert le titre mobile et le condensé TV.
  - `.font-display` — chasse 88 %, graisse 700 : titres d'écran.
  - `.font-stage` — chasse 74 %, graisse 800, capitales : révélations et verdicts TV.
- **`--font-sans`** — Inter Tight Variable : toute l'interface. Chiffres **tabulaires par défaut** (les chronos et scores ne sautent plus).
- `.kicker` — sur-titre espacé en capitales (« MANCHE 2 / 6 »).

**Deux échelles qui ne se mélangent jamais :**
- Téléphone : `text-2xs` → `text-3xl` (11 → 36 px), 8 pas.
- TV : `text-tv-xs` → `text-tv-3xl` (20 → 104 px), 7 pas.

## Formes & élévation

Rayons : `control` 14 px · `card` 20 px · `sheet` 28 px · `chip` plein.

Ombres : `shadow-card` · `shadow-raised` · `shadow-float` · `shadow-spark`.

> **Le glassmorphism devient un signal rare**, réservé au flottant réel (modales, feuilles). Il n'est plus la surface par défaut : quand tout flotte, rien ne flotte.

## Motion — 4 mouvements nommés, et rien d'autre

| Nom | Quand | Durée | Surface |
|---|---|---|---|
| **Deal** | Distribution, apparition | `--dur-deal` 420 ms | TV + tél. |
| **Reveal** | Vérité dévoilée | `--dur-suspense` 600 ms puis bascule | TV surtout |
| **Verdict** | Gagnant / perdant / éliminé | `--dur-verdict` 900 ms | TV |
| **Pulse** | Attente | lent, opacité seule | Tél. (discret) |

Courbes : `--ease-soft` (standard) · `--ease-impact` (verdict) · `--ease-exit`.

**Règles dures :** aucune animation décorative permanente sur téléphone · `transform`/`opacity` uniquement · `prefers-reduced-motion` = coupe franche, jamais une suppression sans remplacement.

## Iconographie

- **Icônes** = interface (jeux, actions, états). Base open-source professionnelle + ~10 icônes maison pour les familles de jeux.
- **Emoji** = **uniquement** expression humaine (réactions des joueurs).

L'inverse — 111 emojis en rôle de composants — était le marqueur n° 1 de « produit généré ».

## Feuille de route

| Lot | Contenu | État |
|---|---|---|
| **0** | Tokens, échelles typo, polices, couche de base | ✅ **fait** |
| 1 | `Surface`, `Button`, `Player`, badges, `Meter`, `ActionBar` | à venir |
| 2 | Primitives : `Stage`, `Moment`, `Prompt`, `PlayerRail`, `WaitState`, `Verdict` | à venir |
| 3 | Écrans : accueil, salon, TV, mode soirée | à venir |
| 4 | Iconographie | à venir |
| 5 | Motion & calage sonore | à venir |

## Note d'implémentation

`tokens.css` utilise **`@theme static`**. Sans `static`, Tailwind v4 n'émet que les variables des utilitaires réellement employés — nos tokens sont aussi lus en `var(--color-…)` depuis des styles inline (halos, fonds de scène, dégradés de jaquette), et ils tomberaient silencieusement à vide.
