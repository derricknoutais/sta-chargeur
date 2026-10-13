import { type Attente, type Mode } from './chargeur.js';
/** Une requête Livewire, résumée : ce qu'elle appelle, ce qu'elle synchronise. */
export interface EchangeLivewire {
    /** Le nom du composant (`clients.liste`). */
    composant: string;
    /** Les méthodes appelées (`enregistrer`, `$refresh`, `nextPage`). */
    appels: string[];
    /** Les champs synchronisés (`wire:model`). */
    champs: string[];
    /** Les événements émis (`$emit`). */
    evenements: string[];
}
export interface OptionsLivewire {
    /**
     * Le mode d'une requête, ou `null` pour ne rien montrer. `parDefaut` : une
     * méthode de l'application → `voile` ; un champ, un événement, `$refresh`,
     * `$set`, `$toggle` ou la pagination → `pastille`.
     */
    classer?: (echange: EchangeLivewire, parDefaut: Mode | null) => Mode | null;
    /** Le message d'une requête ; `null` ou rien → celui par défaut. */
    decrire?: (echange: EchangeLivewire, mode: Mode) => Attente | null | undefined;
    /** Durée maximale d'une redirection qui ne quitte pas la page (téléchargement). Défaut : 15 000 ms. */
    securite?: number;
}
/** L'objet `Livewire` global (`window.Livewire`). */
export interface Livewire {
    hook(nom: string, rappel: (...args: any[]) => void): unknown;
    navigate?: unknown;
}
/**
 * Montre le chargeur pendant les requêtes Livewire 2 (`wire:click`,
 * `wire:submit`, `wire:model`) et les envois de fichiers. À appeler après le
 * chargement de Livewire :
 *
 *     document.addEventListener('livewire:load', () => brancherLivewire(window.Livewire));
 *
 * Livewire 3 n'est pas encore pris en charge : son API de crochets a changé.
 */
export declare function brancherLivewire(livewire: Livewire, options?: OptionsLivewire): () => void;
