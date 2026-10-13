import { type Attente } from './chargeur.js';
/** Au-delà, le voile d'un départ se retire même si la page est restée là. */
export declare const SECURITE = 15000;
/**
 * Le voile jusqu'au départ de la page — un lien, un formulaire, une
 * redirection (Inertia vers une autre adresse, Livewire). La page qui s'en va
 * l'emporte avec elle ; celle qui reste — un téléchargement, un départ annulé —
 * le retire au bout de `securite`, et un retour arrière qui la ressort du
 * cache du navigateur le retire aussitôt.
 *
 * Rend la fonction qui le retire avant l'heure.
 */
export declare function attendreDepart(attente: Attente, securite?: number): () => void;
