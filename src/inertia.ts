import { chargeur, type Attente, type Mode } from './chargeur.js';
import { attendreDepart, SECURITE } from './depart.js';

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
    /** `get`, `post`, `put`, `patch`, `delete`. */
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
    /** Le message d'une visite ; `null` ou rien → celui par défaut. */
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

// Inertia 1, 2 et 3 notent une redirection vers une autre adresse sous cette
// clé, juste avant de changer `window.location` ; la page suivante l'efface.
const CLE_REDIRECTION = 'inertiaLocationVisit';

function marqueRedirection(): string | null {
    try {
        return window.sessionStorage ? window.sessionStorage.getItem(CLE_REDIRECTION) : null;
    } catch (e) {
        // Navigation privée stricte, stockage interdit : on fait sans.
        return null;
    }
}

// Le routeur d'Inertia, typé large : ses signatures changent d'une version à l'autre.
interface RouteurInertia {
    on(evenement: any, rappel: (evenement: any) => any): any;
}

function simplifier(brute: VisiteInertia): Visite {
    const url = typeof brute.url === 'string' ? new URL(brute.url, window.location.href) : brute.url;
    return { methode: String(brute.method || 'get').toLowerCase(), chemin: url.pathname, url, brute };
}

function classerParDefaut(visite: Visite): Mode | null {
    // Un préchargement, un rechargement en tâche de fond : personne n'attend.
    if (visite.brute.prefetch === true || visite.brute.showProgress === false) return null;
    // Un filtre, une autre page de la même liste : l'écran reste utilisable.
    if (visite.methode === 'get' && visite.chemin === window.location.pathname) return 'pastille';

    return 'voile';
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
export function brancherInertia(router: RouteurInertia, options: OptionsInertia = {}): () => void {
    // Chaque visite commencée : sa fin, et la marque de redirection qu'on
    // voyait à son départ. Clé : la visite, et aussi son URL — Inertia 1 passe
    // à `finish` une copie de la visite (`{ ...visite }`), qui garde la même
    // URL ; Inertia 2 et 3 passent le même objet.
    const suivies = new WeakMap<object, { fin: () => void; marque: string | null }>();

    const retirerDebut = router.on('start', (evenement: CustomEvent<{ visit: VisiteInertia }>) => {
        const brute = evenement.detail.visit;
        const visite = simplifier(brute);
        const parDefaut = classerParDefaut(visite);
        const mode = options.classer ? options.classer(visite, parDefaut) : parDefaut;
        if (!mode) return;

        const attente = (options.decrire && options.decrire(visite, mode)) || {};
        const suivie = { fin: chargeur().attendre(mode, attente), marque: marqueRedirection() };
        suivies.set(brute, suivie);
        if (typeof brute.url === 'object') suivies.set(brute.url, suivie);
    });

    const retirerFin = router.on('finish', (evenement: CustomEvent<{ visit: VisiteInertia }>) => {
        const brute = evenement.detail.visit;
        const parUrl = typeof brute.url === 'object' ? brute.url : null;
        const suivie = suivies.get(brute) || (parUrl ? suivies.get(parUrl) : undefined);
        if (!suivie) return;

        suivies.delete(brute);
        if (parUrl) suivies.delete(parUrl);
        // Une marque apparue pendant la visite : le serveur a renvoyé ailleurs
        // et la page est en train de partir. Le voile la suit jusqu'au bout.
        const marque = marqueRedirection();
        if (marque !== null && marque !== suivie.marque) {
            attendreDepart(options.redirection || { message: 'Redirection…' }, options.securite || SECURITE);
        }
        suivie.fin();
    });

    return () => {
        if (typeof retirerDebut === 'function') retirerDebut();
        if (typeof retirerFin === 'function') retirerFin();
    };
}
