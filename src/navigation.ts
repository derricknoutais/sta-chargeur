import { type Attente } from './chargeur.js';
import { attendreDepart, departEnCours, SECURITE } from './depart.js';

/** Un départ de page vu par `decrire`. */
export interface Navigation {
    /** `code` : `location.href = …`, `location.reload()`, `form.submit()`. */
    type: 'lien' | 'formulaire' | 'code';
    /** `get`, `post` — ou la méthode simulée par Laravel (`_method`) : `put`, `patch`, `delete`. */
    methode: string;
    url: URL;
    /** Le lien ou le formulaire ; pour un départ du code, le formulaire de `form.submit()` (Chrome 112+), sinon `<html>`. */
    element: Element;
}

export interface OptionsNavigation {
    /** Suivre les clics sur les liens. Défaut : oui. */
    liens?: boolean;
    /** Suivre l'envoi des formulaires. Défaut : oui. */
    formulaires?: boolean;
    /**
     * Suivre les départs lancés par le code (`location.href = …`,
     * `location.reload()`, `form.submit()`), que seule l'API Navigation voit
     * (Chrome 102+). Ailleurs — terminaux Sunmi, anciens navigateurs — rien :
     * poser `attendreDepart()` avant de partir. Défaut : oui.
     */
    code?: boolean;
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

// Ce qu'on lit d'un lien ou d'un formulaire ; un élément du DOM convient.
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
export const REFUS = '[data-sta-chargeur="non"]';

// Un fichier qu'on télécharge ne quitte pas la page.
const FICHIER = /\.(pdf|csv|xlsx?|ods|docx?|odt|pptx?|zip|rar|7z|gz|png|jpe?g|gif|webp|svg|txt|json|xml|apk|mp3|mp4)$/i;

function adresse(brute: string, ici: Ici): URL | null {
    try {
        const url = new URL(brute, ici.href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        // Un autre site : on quitte l'application, ce n'est plus son attente.
        if (url.origin !== ici.origin) return null;
        if (FICHIER.test(url.pathname)) return null;
        return url;
    } catch {
        return null;
    }
}

/** L'adresse vers laquelle part ce clic, ou `null` s'il ne change pas de page. */
export function departParLien(lien: Lien, clic: Clic, ici: Ici): URL | null {
    if (clic.defaultPrevented) return null;
    // Un nouvel onglet, une nouvelle fenêtre : cette page-ci reste.
    if ((clic.button !== undefined && clic.button !== 0) || clic.ctrlKey || clic.metaKey || clic.shiftKey || clic.altKey) return null;
    if (lien.target && lien.target !== '_self') return null;
    if (lien.hasAttribute('download') || lien.closest(REFUS)) return null;

    const brut = lien.getAttribute('href');
    if (brut === null || brut === '' || brut.charAt(0) === '#') return null;

    const url = adresse(lien.href || brut, ici);
    if (!url) return null;
    // Une ancre dans la page.
    if (url.hash && url.pathname === ici.pathname && url.search === ici.search) return null;

    return url;
}

/** Où et comment part ce formulaire, ou `null` s'il ne change pas de page. */
export function departParFormulaire(formulaire: Formulaire, envoi: { defaultPrevented: boolean }, ici: Ici): { url: URL; methode: string } | null {
    if (envoi.defaultPrevented) return null;
    // Par les attributs : un champ nommé `action` ou `target` masquerait les
    // propriétés du même nom.
    const cible = formulaire.getAttribute('target');
    if (cible && cible !== '_self') return null;
    if (formulaire.closest(REFUS)) return null;

    const url = adresse(formulaire.getAttribute('action') || ici.href, ici);
    if (!url) return null;

    let methode = (formulaire.getAttribute('method') || 'get').toLowerCase();
    // Laravel simule PUT, PATCH et DELETE par un champ caché `_method`.
    const champs = formulaire.elements as { namedItem?: (nom: string) => unknown } | undefined;
    const simule = champs && typeof champs.namedItem === 'function' ? (champs.namedItem('_method') as { value?: string } | null) : null;
    if (methode === 'post' && simule && simule.value) methode = simule.value.toLowerCase();

    return { url, methode };
}

// Ce qu'on lit d'un événement `navigate` de l'API Navigation.
interface EvenementNavigate {
    userInitiated?: boolean;
    hashChange?: boolean;
    navigationType?: string;
    downloadRequest?: string | null;
    formData?: unknown;
    destination?: { url: string; sameDocument?: boolean };
    defaultPrevented?: boolean;
    signal?: { addEventListener?: (type: string, rappel: () => void) => void };
    /** Le formulaire d'un `form.submit()` (Chrome 112+) ; `null` pour `location.href = …`. */
    sourceElement?: Element | null;
}

/**
 * Où part la page quand le code la fait partir, ou `null` si ce départ ne la
 * quitte pas ou n'est pas le nôtre. Les clics et les envois de l'utilisateur
 * (`userInitiated`) sont laissés aux écouteurs de liens et de formulaires.
 * D'après l'intégration dans Shipper.
 */
export function departParCode(evenement: EvenementNavigate, ici: Ici): { url: URL; methode: string; rechargement: boolean } | null {
    if (evenement.userInitiated || evenement.hashChange) return null;
    if (!evenement.destination || evenement.destination.sameDocument) return null;
    if (evenement.downloadRequest !== null && evenement.downloadRequest !== undefined) return null;
    const type = evenement.navigationType || '';
    if (type !== 'push' && type !== 'replace' && type !== 'reload') return null;

    const url = adresse(evenement.destination.url, ici);
    if (!url) return null;

    // `formData` n'existe que pour un POST ; un GET se lit dans l'adresse.
    return { url, methode: evenement.formData ? 'post' : 'get', rechargement: type === 'reload' };
}

function messageParDefaut(navigation: Navigation): string {
    if (navigation.methode === 'get') return 'Chargement…';
    if (navigation.methode === 'delete') return 'Suppression…';
    return 'Enregistrement…';
}

/**
 * Ce que la page dit d'un départ, sans une ligne de JavaScript :
 * `data-sta-chargeur-message` et `data-sta-chargeur-detail`, sur le bouton
 * d'envoi, le lien, le formulaire ou un ancêtre — le plus proche l'emporte.
 *
 *     <form method="POST" action="/oauth/authorize" data-sta-chargeur-message="Autorisation en cours…">
 */
export function attenteDeclaree(...elements: Array<Pick<Element, 'closest'> | null | undefined>): Attente {
    const lire = (attribut: string): string | undefined => {
        for (const element of elements) {
            const porteur = element && typeof element.closest === 'function' ? element.closest(`[${attribut}]`) : null;
            if (porteur) return porteur.getAttribute(attribut) || undefined;
        }
        return undefined;
    };

    return { message: lire('data-sta-chargeur-message'), detail: lire('data-sta-chargeur-detail') };
}

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
export function brancherNavigation(options: OptionsNavigation = {}): () => void {
    if (typeof document === 'undefined') return () => {};

    const { liens = true, formulaires = true, code = true, securite = SECURITE } = options;
    // Les départs lancés par ce branchement, à retirer s'il est débranché.
    const mesDeparts: Array<() => void> = [];
    // Le dernier bouton cliqué : le bouton d'envoi d'un formulaire, que Chrome
    // ne donne (`submitter`) qu'à partir de la version 81.
    let dernierBouton: Element | null = null;

    function partir(navigation: Navigation, soumetteur?: Element | null, parDefaut?: string): () => void {
        const declare = attenteDeclaree(soumetteur, navigation.element);
        const decrit: Attente = (options.decrire && options.decrire(navigation)) || {};
        const fin = attendreDepart(
            {
                message: declare.message || decrit.message || parDefaut || messageParDefaut(navigation),
                detail: declare.detail !== undefined ? declare.detail : decrit.detail,
            },
            securite,
        );
        mesDeparts.push(fin);
        return fin;
    }

    // On regarde une fois l'événement entièrement distribué : un gestionnaire
    // posé après le nôtre (jQuery délégué sur `document`, par exemple) peut
    // encore l'annuler.
    const surClic = (evenement: MouseEvent) => {
        const cible = evenement.target as Element | null;
        if (!cible || typeof cible.closest !== 'function') return;
        const bouton = cible.closest('button, input[type="submit"], input[type="image"]');
        if (bouton) dernierBouton = bouton;
        const lien = liens ? (cible.closest('a[href]') as HTMLAnchorElement | null) : null;
        if (!lien) return;
        setTimeout(() => {
            const url = departParLien(lien, evenement, window.location);
            if (url) partir({ type: 'lien', methode: 'get', url, element: lien });
        }, 0);
    };

    const surEnvoi = (evenement: Event) => {
        const formulaire = evenement.target as HTMLFormElement | null;
        if (!formulaire || formulaire.tagName !== 'FORM') return;
        const soumis = (evenement as Event & { submitter?: Element | null }).submitter;
        const soumetteur = soumis || (dernierBouton && formulaire.contains(dernierBouton) ? dernierBouton : null);
        setTimeout(() => {
            const depart = departParFormulaire(formulaire, evenement, window.location);
            if (depart) partir({ type: 'formulaire', methode: depart.methode, url: depart.url, element: formulaire }, soumetteur);
        }, 0);
    };

    // Les départs du code : l'API Navigation, quand elle existe.
    const api = (window as unknown as { navigation?: { addEventListener(t: string, f: (e: EvenementNavigate) => void): void; removeEventListener(t: string, f: (e: EvenementNavigate) => void): void } }).navigation;
    const surNavigation = (evenement: EvenementNavigate) => {
        const depart = departParCode(evenement, window.location);
        if (!depart) return;
        setTimeout(() => {
            // Un autre écouteur a pu l'annuler.
            if (evenement.defaultPrevented) return;
            // Déjà annoncé — une redirection d'Inertia (« Redirection… »), un
            // formulaire envoyé par requestSubmit() : le voile est là, et une
            // seconde attente remplacerait seulement la phrase la plus juste.
            if (departEnCours()) return;
            // Le formulaire d'un `form.submit()` porte ses attributs
            // data-sta-chargeur-* comme un envoi ordinaire ; sinon, `<html>`.
            const source = evenement.sourceElement;
            const element = source && typeof source.closest === 'function' ? source : document.documentElement;
            const fin = partir(
                { type: 'code', methode: depart.methode, url: depart.url, element },
                null,
                depart.rechargement ? 'Rechargement de la page…' : undefined,
            );
            // Une navigation interrompue (une autre la remplace, Échap) : on retire.
            if (evenement.signal && typeof evenement.signal.addEventListener === 'function') evenement.signal.addEventListener('abort', fin);
        }, 0);
    };

    if (liens || formulaires) document.addEventListener('click', surClic);
    if (formulaires) document.addEventListener('submit', surEnvoi);
    if (code && api && typeof api.addEventListener === 'function') api.addEventListener('navigate', surNavigation);

    return () => {
        document.removeEventListener('click', surClic);
        document.removeEventListener('submit', surEnvoi);
        if (api && typeof api.removeEventListener === 'function') api.removeEventListener('navigate', surNavigation);
        mesDeparts.splice(0).forEach((fin) => fin());
    };
}
