/**
 * Primitives de jeu — le vocabulaire commun aux 17 jeux.
 *
 * Règle : un jeu ne dessine plus une scène TV, une révélation, une carte-question ni un écran
 * d'attente « à sa façon ». Il compose ces primitives. C'est ce qui rend l'app cohérente d'un jeu
 * à l'autre, et ce qui fait qu'ajouter un jeu ne coûte plus une nouvelle mise en page complète.
 */
export { Stage } from './Stage'
export { Moment, useMomentBeat, type MomentBeat } from './Moment'
export { Prompt } from './Prompt'
export { PlayerRail, type PlayerRailProps } from './PlayerRail'
export { Verdict, type VerdictTone } from './Verdict'
export { WaitState } from './WaitState'
export { HostCue } from './HostCue'
