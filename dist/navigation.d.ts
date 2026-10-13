import { type Attente } from './chargeur.js';
/** Un départ de page vu par `decrire`. */
export interface Navigation {
    type: 'lien' | 'formulaire';
    /** `get`, `post` — ou la méthode simulée par Laravel (`_method`) : `put`, `patch`, `delete`. */
    methode: string;
    url: URL;
    element: Element;
}
export interface OptionsNavigation {
    /** Suivre les clics sur les liens. Défaut : oui. */
    liens?: boolean;
    /** Suivre l'envoi des formulaires. Défaut : oui. */
    formulaires?: boolean;
    /**
     * Le message d'un départ ; `null` ou rien → celui par défaut. Un message
     * posé dans la page (`data-sta-chargeur-message`) l'emporte.
     */
    decrire?: (navigation: Navigation) => Attente | null | undefined;
    /**
     * Au-delà, le voile se retire même si la page est restée là : un lien qui
     * télécharge un fichier ne quitte pas la page. Défaut : 15 000 ms.
     */
    securite?: number;
}
interface Element_ {
    getAttribute(nom: string): string | null;
    hasAttribute(nom: string): boolean;
    closest(selecteur: string): unknown;
}
interface Lien extends Element_ {
    href: string;
    target: string;
}
interface Formulaire extends Element_ {
    elements?: unknown;
}
interface Clic {
    defaultPrevented: boolean;
    button?: number;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
}
interface Ici {
    origin: string;
    pathname: string;
    search: string;
    href: string;
}
/** Ce qui écarte un lien ou un formulaire : `data-sta-chargeur="non"` sur lui ou un ancêtre. */
export declare const REFUS = "[data-sta-chargeur=\"non\"]";
/** L'adresse vers laquelle part ce clic, ou `null` s'il ne change pas de page. */
export declare function departParLien(lien: Lien, clic: Clic, ici: Ici): URL | null;
/** Où et comment part ce formulaire, ou `null` s'il ne change pas de page. */
export declare function departParFormulaire(formulaire: Formulaire, envoi: {
    defaultPrevented: boolean;
}, ici: Ici): {
    url: URL;
    methode: string;
} | null;
/**
 * Ce que la page dit d'un départ, sans une ligne de JavaScript :
 * `data-sta-chargeur-message` et `data-sta-chargeur-detail`, sur le bouton
 * d'envoi, le lien, le formulaire ou un ancêtre — le plus proche l'emporte.
 *
 *     <form method="POST" action="/oauth/authorize" data-sta-chargeur-message="Autorisation en cours…">
 */
export declare function attenteDeclaree(...elements: Array<Pick<Element, 'closest'> | null | undefined>): Attente;
/**
 * Pour les pages classiques (Blade) : montre le voile quand on quitte la page
 * par un lien ou un formulaire, le temps que la suivante arrive.
 *
 * Écartés d'office : les clics et envois déjà interceptés par l'application
 * (`preventDefault` — Vue, Livewire, Inertia), les nouveaux onglets, les ancres,
 * les autres sites, les fichiers et les liens `download`. Pour écarter le
 * reste — un export qui télécharge sans le dire — `data-sta-chargeur="non"`
 * sur le lien, le formulaire ou un ancêtre. Le message se donne dans la page
 * (`data-sta-chargeur-message`, `data-sta-chargeur-detail`) ou par `decrire`.
 *
 * Rend la fonction qui débranche.
 */
export declare function brancherNavigation(options?: OptionsNavigation): () => void;
export {};
