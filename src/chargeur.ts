import { injecterStyles } from './styles.js';
import { voiture, type Theme } from './voiture.js';

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
    /**
     * Avant de se retirer, il attend encore ce temps : une attente qui en
     * enchaîne une autre (une requête lancée dans le `.then` de la
     * précédente) le trouve encore là, au lieu de le faire retomber puis
     * revenir 200 ms plus tard. Défaut : 100 ms.
     */
    grace?: number;
    /** Défaut : `classe` (sombre sous `.dark`). */
    theme?: Theme;
    /** Les messages quand l'attente n'en donne pas. */
    messages?: { voile?: string; pastille?: string };
}

/** Ce qui dessine. Le DOM par défaut ; un faux dans les tests. */
export interface Rendu {
    afficher(mode: Mode, attente: { message: string; detail: string | null }, theme: Theme): void;
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
    etat(): { affiche: Mode | null; voiles: number; pastilles: number; message: string | null };
}

interface Entree {
    mode: Mode;
    message: string;
    detail: string | null;
}

const PAR_DEFAUT = { delai: 200, minimum: 450, grace: 100, theme: 'classe' as Theme, voile: 'Chargement…', pastille: 'Mise à jour…' };

/**
 * Crée un chargeur indépendant. Les applications n'en veulent qu'un par page :
 * elles passent par `chargeur()`, que partagent tous les branchements.
 */
export function creerChargeur(options: Options = {}, rendu: Rendu = renduDom()): Chargeur {
    const reglages = { ...PAR_DEFAUT };
    appliquer(options);

    function appliquer(o: Options) {
        if (o.delai !== undefined) reglages.delai = o.delai;
        if (o.minimum !== undefined) reglages.minimum = o.minimum;
        if (o.grace !== undefined) reglages.grace = o.grace;
        if (o.theme !== undefined) reglages.theme = o.theme;
        if (o.messages && o.messages.voile) reglages.voile = o.messages.voile;
        if (o.messages && o.messages.pastille) reglages.pastille = o.messages.pastille;
    }

    // Les attentes en cours, dans l'ordre d'arrivée : la plus récente parle.
    // Une liste plutôt qu'un drapeau — une visite annulée par la suivante se
    // termine après que l'autre a commencé : un booléen éteindrait le chargeur
    // de celle qui commence.
    const entrees: Entree[] = [];
    let affiche: Mode | null = null;
    let montre: { message: string; detail: string | null } | null = null;
    let minuteurAffichage: ReturnType<typeof setTimeout> | undefined;
    let minuteurMasquage: ReturnType<typeof setTimeout> | undefined;
    let afficheDepuis = 0;
    let planifie = false;

    const derniere = (mode: Mode): Entree | undefined => {
        for (let i = entrees.length - 1; i >= 0; i--) if (entrees[i].mode === mode) return entrees[i];
        return undefined;
    };

    const demande = (): Mode | null => (derniere('voile') ? 'voile' : derniere('pastille') ? 'pastille' : null);

    function dessiner() {
        if (!affiche) {
            montre = null;
            rendu.masquer();
            return;
        }
        // Pendant le temps minimum, plus rien n'attend : on garde la dernière phrase.
        const entree = derniere(affiche);
        if (entree) montre = { message: entree.message, detail: entree.detail };
        rendu.afficher(affiche, montre || { message: reglages[affiche], detail: null }, reglages.theme);
    }

    // Une visite qui en remplace une autre fait, dans le même tour, « fin » puis
    // « début » : on ne regarde qu'une fois le tour fini, comme Vue regroupe ses
    // mises à jour — sinon le chargeur clignoterait entre les deux.
    function planifier() {
        if (planifie) return;
        planifie = true;
        Promise.resolve().then(() => {
            planifie = false;
            evaluer();
        });
    }

    function evaluer() {
        const mode = demande();

        if (mode) {
            if (minuteurMasquage !== undefined) {
                clearTimeout(minuteurMasquage);
                minuteurMasquage = undefined;
            }
            // Déjà à l'écran : il suit (une recherche qui finit sous un voile,
            // un voile qui succède à la pastille, un nouveau message).
            if (affiche) {
                affiche = mode;
                dessiner();
                return;
            }
            if (minuteurAffichage === undefined) {
                minuteurAffichage = setTimeout(() => {
                    minuteurAffichage = undefined;
                    const m = demande();
                    if (!m) return;
                    affiche = m;
                    afficheDepuis = Date.now();
                    dessiner();
                }, reglages.delai);
            }
            return;
        }

        if (minuteurAffichage !== undefined) {
            clearTimeout(minuteurAffichage);
            minuteurAffichage = undefined;
        }
        if (!affiche) return;

        const reste = Math.max(reglages.minimum - (Date.now() - afficheDepuis), reglages.grace);
        if (reste <= 0) {
            affiche = null;
            dessiner();
            return;
        }
        if (minuteurMasquage === undefined) {
            minuteurMasquage = setTimeout(() => {
                minuteurMasquage = undefined;
                if (demande()) return;
                affiche = null;
                dessiner();
            }, reste);
        }
    }

    function attendre(mode: Mode, attente: Attente = {}): () => void {
        const entree: Entree = {
            mode,
            message: attente.message || reglages[mode],
            detail: mode === 'voile' && attente.detail ? attente.detail : null,
        };
        entrees.push(entree);
        planifier();

        let fini = false;
        return () => {
            if (fini) return;
            fini = true;
            const i = entrees.indexOf(entree);
            if (i >= 0) entrees.splice(i, 1);
            planifier();
        };
    }

    async function suivre<T>(promesse: Promise<T>, attente?: string | Attente, mode: Mode = 'pastille'): Promise<T> {
        const fin = attendre(mode, typeof attente === 'string' ? { message: attente } : attente || {});
        try {
            return await promesse;
        } finally {
            fin();
        }
    }

    return {
        attendre,
        suivre,
        configurer(o: Options) {
            appliquer(o);
            if (affiche) dessiner();
        },
        etat() {
            return {
                affiche,
                voiles: entrees.filter((e) => e.mode === 'voile').length,
                pastilles: entrees.filter((e) => e.mode === 'pastille').length,
                message: affiche && montre ? montre.message : null,
            };
        },
    };
}

/**
 * Les touches qui ne passent pas sous le voile. Le voile arrête la souris, pas
 * le clavier : sans lui, Entrée sur le bouton qui garde le focus relance le
 * geste en attente — trois appuis, trois paiements (vu dans STA Compta). Passent
 * seulement Tab, les touches de fonction (F5) et les raccourcis du navigateur
 * (Ctrl, Cmd, Alt).
 */
export function toucheBloquee(evenement: { key?: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): boolean {
    if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return false;
    const touche = evenement.key || '';
    return touche !== 'Tab' && !/^F\d{1,2}$/.test(touche);
}

const EVENEMENTS_CLAVIER = ['keydown', 'keypress', 'keyup'];

/**
 * Le rendu dans la page : un bloc ajouté à la fin de `<body>`, hors de
 * l'application — Inertia remplace le contenu de `#app` à chaque visite, pas
 * celui de `<body>`. Créé à la première attente qui dure.
 */
export function renduDom(): Rendu {
    let racine: HTMLElement | null = null;
    let themeMonte: Theme | null = null;
    let elements: {
        annonce: HTMLElement;
        voile: HTMLElement;
        message: HTMLElement;
        detail: HTMLElement;
        pastille: HTMLElement;
        texte: HTMLElement;
    } | null = null;

    function monter(theme: Theme) {
        if (typeof document === 'undefined' || !document.body) return;
        injecterStyles();

        // Remonté si le thème change : les deux voitures portent le leur.
        if (!racine || themeMonte !== theme) {
            if (racine && racine.parentNode) racine.parentNode.removeChild(racine);
            racine = document.createElement('div');
            racine.className = `sta-chargeur sta-theme-${theme}`;
            racine.innerHTML =
                // Annoncé aux lecteurs d'écran par une zone toujours présente :
                // une zone `aria-live` qui apparaît avec son texte n'est pas lue.
                '<div class="sta-annonce" role="status" aria-live="polite"></div>' +
                '<div class="sta-voile"><div class="sta-carte">' +
                voiture({ largeur: 240, theme }) +
                '<p class="sta-message"></p><p class="sta-detail"></p></div></div>' +
                '<div class="sta-pastille">' +
                voiture({ largeur: 64, slogan: false, theme }) +
                '<span class="sta-pastille-texte"></span></div>';
            const q = (sel: string) => racine!.querySelector(sel) as HTMLElement;
            elements = {
                annonce: q('.sta-annonce'),
                voile: q('.sta-voile'),
                message: q('.sta-message'),
                detail: q('.sta-detail'),
                pastille: q('.sta-pastille'),
                texte: q('.sta-pastille-texte'),
            };
            themeMonte = theme;
        }
        // Une navigation qui remplace tout `<body>` (Livewire, Turbo) l'a emporté.
        if (!racine.parentNode) document.body.appendChild(racine);
    }

    // Tant que le voile est là, le clavier s'arrête à la fenêtre (phase de
    // capture) : rien n'atteint la page dessous.
    let clavierGarde = false;
    const garde = (evenement: KeyboardEvent) => {
        if (!toucheBloquee(evenement)) return;
        evenement.preventDefault();
        evenement.stopPropagation();
    };
    function garderClavier(actif: boolean) {
        if (actif === clavierGarde || typeof window === 'undefined') return;
        clavierGarde = actif;
        for (const type of EVENEMENTS_CLAVIER) {
            if (actif) window.addEventListener(type, garde as EventListener, true);
            else window.removeEventListener(type, garde as EventListener, true);
        }
    }

    function basculer(el: HTMLElement, visible: boolean) {
        const deja = el.className.indexOf('sta-visible') >= 0;
        if (visible && !deja) el.className += ' sta-visible';
        if (!visible && deja) el.className = el.className.replace(/\s*sta-visible/g, '');
    }

    return {
        afficher(mode, attente, theme) {
            monter(theme);
            if (!elements || !racine) return;
            // Une modale (Reka UI, Headless UI) cache aux lecteurs d'écran tout
            // ce qui n'est pas elle, nous compris : l'annonce serait muette.
            racine.removeAttribute('aria-hidden');
            racine.removeAttribute('inert');
            garderClavier(mode === 'voile');
            const { annonce, voile, message, detail, pastille, texte } = elements;
            if (mode === 'voile') {
                message.textContent = attente.message;
                detail.textContent = attente.detail || '';
                detail.style.display = attente.detail ? '' : 'none';
            } else {
                texte.textContent = attente.message;
            }
            basculer(voile, mode === 'voile');
            basculer(pastille, mode === 'pastille');
            if (annonce.textContent !== attente.message) annonce.textContent = attente.message;
        },
        masquer() {
            garderClavier(false);
            if (!elements) return;
            basculer(elements.voile, false);
            basculer(elements.pastille, false);
            elements.annonce.textContent = '';
        },
    };
}

type FenetreSta = { __staChargeur?: Chargeur };

let instance: Chargeur | null = null;

/**
 * Le chargeur de la page, partagé par tous les branchements — et par deux
 * copies du paquet chargées dans la même page (une par bundle), qui se le
 * passent par `window`. Des options passées à un appel suivant s'appliquent
 * aussi, comme `chargeur().configurer(…)`.
 */
export function chargeur(options?: Options): Chargeur {
    const fenetre: FenetreSta | null = typeof window !== 'undefined' ? (window as unknown as FenetreSta) : null;
    if (!instance) instance = (fenetre && fenetre.__staChargeur) || null;
    if (!instance) {
        instance = creerChargeur(options);
        if (fenetre) fenetre.__staChargeur = instance;
    } else if (options) {
        instance.configurer(options);
    }

    return instance;
}

/**
 * Montre la pastille le temps que `promesse` se règle — pour un `fetch` ou tout
 * appel qu'aucun branchement ne voit passer. Rend la promesse telle quelle.
 *
 *     const r = await suivre(fetch(`/recherche?q=${q}`), 'Recherche…');
 *     await suivre(rafraichir(), { message: 'Synchronisation…', detail: 'Ne quittez pas.' }, 'voile');
 */
export function suivre<T>(promesse: Promise<T>, attente?: string | Attente, mode: Mode = 'pastille'): Promise<T> {
    return chargeur().suivre(promesse, attente, mode);
}
