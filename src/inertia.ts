import { chargeur, type Attente, type Mode } from './chargeur.js';

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
    // La fin de chaque visite commencée. Clé : la visite, et aussi son URL —
    // Inertia 1 passe à `finish` une copie de la visite (`{ ...visite }`), qui
    // garde la même URL ; Inertia 2 et 3 passent le même objet.
    const fins = new WeakMap<object, () => void>();

    const retirerDebut = router.on('start', (evenement: CustomEvent<{ visit: VisiteInertia }>) => {
        const brute = evenement.detail.visit;
        const visite = simplifier(brute);
        const parDefaut = classerParDefaut(visite);
        const mode = options.classer ? options.classer(visite, parDefaut) : parDefaut;
        if (!mode) return;

        const attente = (options.decrire && options.decrire(visite, mode)) || {};
        const fin = chargeur().attendre(mode, attente);
        fins.set(brute, fin);
        if (typeof brute.url === 'object') fins.set(brute.url, fin);
    });

    const retirerFin = router.on('finish', (evenement: CustomEvent<{ visit: VisiteInertia }>) => {
        const brute = evenement.detail.visit;
        const parUrl = typeof brute.url === 'object' ? brute.url : null;
        const fin = fins.get(brute) || (parUrl ? fins.get(parUrl) : undefined);
        if (!fin) return;

        fins.delete(brute);
        if (parUrl) fins.delete(parUrl);
        fin();
    });

    return () => {
        if (typeof retirerDebut === 'function') retirerDebut();
        if (typeof retirerFin === 'function') retirerFin();
    };
}
