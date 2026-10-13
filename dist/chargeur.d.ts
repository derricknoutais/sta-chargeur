import { type Theme } from './voiture.js';
/**
 * Deux formes d'attente :
 *  - le `voile`, qui couvre l'écran : changer de page, enregistrer, valider —
 *    tout ce qu'un second clic pendant l'attente rendrait ambigu ;
 *  - la `pastille`, en haut, qui ne bloque rien : un filtre, une page de la
 *    même liste, une recherche pendant qu'on tape.
 */
export type Mode = 'voile' | 'pastille';
/** Ce qu'on dit à celui qui attend. */
export interface Attente {
    /** La phrase principale (« Écriture dans Lightspeed… »). */
    message?: string;
    /** Une précision, sous le voile seulement (« Ne quittez pas cette page. »). */
    detail?: string | null;
}
export interface Options {
    /** En dessous, rien ne s'affiche : une navigation instantanée ne clignote pas. Défaut : 200 ms. */
    delai?: number;
    /** Une fois affiché, il reste au moins ce temps : pas d'éclair à 210 ms. Défaut : 450 ms. */
    minimum?: number;
    /** Défaut : `classe` (sombre sous `.dark`). */
    theme?: Theme;
    /** Les messages quand l'attente n'en donne pas. */
    messages?: {
        voile?: string;
        pastille?: string;
    };
}
/** Ce qui dessine. Le DOM par défaut ; un faux dans les tests. */
export interface Rendu {
    afficher(mode: Mode, attente: {
        message: string;
        detail: string | null;
    }, theme: Theme): void;
    masquer(): void;
}
export interface Chargeur {
    /**
     * Signale une attente ; rend la fonction qui la termine (appelable
     * plusieurs fois sans effet). Rien ne s'affiche avant `delai`.
     */
    attendre(mode: Mode, attente?: Attente): () => void;
    /**
     * Montre le chargeur le temps que `promesse` se règle, sans rien changer à
     * son résultat. `attente` : la phrase, ou `{ message, detail }`.
     */
    suivre<T>(promesse: Promise<T>, attente?: string | Attente, mode?: Mode): Promise<T>;
    /** Change les options en cours de route (thème, messages, délais). */
    configurer(options: Options): void;
    /** Pour les tests et le débogage. */
    etat(): {
        affiche: Mode | null;
        voiles: number;
        pastilles: number;
        message: string | null;
    };
}
/**
 * Crée un chargeur indépendant. Les applications n'en veulent qu'un par page :
 * elles passent par `chargeur()`, que partagent tous les branchements.
 */
export declare function creerChargeur(options?: Options, rendu?: Rendu): Chargeur;
/**
 * Le rendu dans la page : un bloc ajouté à la fin de `<body>`, hors de
 * l'application — Inertia remplace le contenu de `#app` à chaque visite, pas
 * celui de `<body>`. Créé à la première attente qui dure.
 */
export declare function renduDom(): Rendu;
/**
 * Le chargeur de la page, partagé par tous les branchements — et par deux
 * copies du paquet chargées dans la même page (une par bundle), qui se le
 * passent par `window`. Des options passées à un appel suivant s'appliquent
 * aussi, comme `chargeur().configurer(…)`.
 */
export declare function chargeur(options?: Options): Chargeur;
/**
 * Montre la pastille le temps que `promesse` se règle — pour un `fetch` ou tout
 * appel qu'aucun branchement ne voit passer. Rend la promesse telle quelle.
 *
 *     const r = await suivre(fetch(`/recherche?q=${q}`), 'Recherche…');
 *     await suivre(rafraichir(), { message: 'Synchronisation…', detail: 'Ne quittez pas.' }, 'voile');
 */
export declare function suivre<T>(promesse: Promise<T>, attente?: string | Attente, mode?: Mode): Promise<T>;
