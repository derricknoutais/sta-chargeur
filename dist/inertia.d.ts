import { type Attente, type Mode } from './chargeur.js';
/** Une visite Inertia telle que les versions 1, 2 et 3 la passent à `start` et `finish`. */
export interface VisiteInertia {
    method: string;
    url: URL | string;
    /** Inertia 2 et suivants. */
    prefetch?: boolean;
    /** Inertia 2 et suivants : faux pour les visites `async` (polling, rechargements de fond). */
    showProgress?: boolean;
}
/** La visite, simplifiée, telle que la reçoivent `classer` et `decrire`. */
export interface Visite {
    /** `get`, `post`, `put`, `patch`, `delete` — la méthode simulée (`_method`) l'emporte sur POST. */
    methode: string;
    /** `/revue/19/valider` — sans domaine ni paramètres. */
    chemin: string;
    url: URL;
    /** La visite d'origine, propre à chaque version d'Inertia. */
    brute: VisiteInertia;
}
export interface OptionsInertia {
    /**
     * Le mode d'une visite, ou `null` pour ne rien montrer. `parDefaut` :
     * préchargement ou `showProgress: false` → `null` ; GET vers la page
     * affichée (filtre, tri, pagination) → `pastille` ; le reste → `voile`.
     */
    classer?: (visite: Visite, parDefaut: Mode | null) => Mode | null;
    /**
     * Le message d'une visite ; `null` ou rien → celui par défaut : sous le
     * voile, « Enregistrement… » (POST, PUT, PATCH), « Suppression… »
     * (DELETE), « Chargement… » (GET) ; sur la pastille, « Mise à jour… ».
     */
    decrire?: (visite: Visite, mode: Mode) => Attente | null | undefined;
    /**
     * Ce qu'on dit quand le serveur renvoie vers une autre adresse
     * (`Inertia::location()`, réponse 409) : la visite est finie, mais la page
     * part — le voile reste jusqu'au départ. Défaut : « Redirection… ».
     */
    redirection?: Attente;
    /** Durée maximale d'une redirection qui ne quitte pas la page (téléchargement). Défaut : 15 000 ms. */
    securite?: number;
}
interface RouteurInertia {
    on(evenement: any, rappel: (evenement: any) => any): any;
}
/**
 * Montre le chargeur pendant les visites Inertia (versions 1, 2 et 3). À
 * appeler une fois, au démarrage, avec `progress: false` dans
 * `createInertiaApp` pour retirer la barre d'Inertia :
 *
 *     import { router } from '@inertiajs/vue3';
 *     brancherInertia(router, { decrire: (v) => … });
 *
 * Rend la fonction qui débranche.
 */
export declare function brancherInertia(router: RouteurInertia, options?: OptionsInertia): () => void;
export {};
