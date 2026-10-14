var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { injecterStyles } from './styles.js';
import { voiture } from './voiture.js';
const PAR_DEFAUT = { delai: 200, minimum: 450, grace: 100, theme: 'classe', clavier: true, voile: 'Chargement…', pastille: 'Mise à jour…' };
/**
 * Crée un chargeur indépendant. Les applications n'en veulent qu'un par page :
 * elles passent par `chargeur()`, que partagent tous les branchements.
 */
export function creerChargeur(options = {}, rendu = renduDom()) {
    const reglages = Object.assign({}, PAR_DEFAUT);
    appliquer(options);
    function appliquer(o) {
        if (o.delai !== undefined)
            reglages.delai = o.delai;
        if (o.minimum !== undefined)
            reglages.minimum = o.minimum;
        if (o.grace !== undefined)
            reglages.grace = o.grace;
        if (o.theme !== undefined)
            reglages.theme = o.theme;
        if (o.clavier !== undefined)
            reglages.clavier = o.clavier;
        if (o.messages && o.messages.voile)
            reglages.voile = o.messages.voile;
        if (o.messages && o.messages.pastille)
            reglages.pastille = o.messages.pastille;
    }
    // Les attentes en cours, dans l'ordre d'arrivée : la plus récente parle.
    // Une liste plutôt qu'un drapeau — une visite annulée par la suivante se
    // termine après que l'autre a commencé : un booléen éteindrait le chargeur
    // de celle qui commence.
    const entrees = [];
    let affiche = null;
    let montre = null;
    let minuteurAffichage;
    let minuteurMasquage;
    let afficheDepuis = 0;
    let planifie = false;
    const derniere = (mode) => {
        for (let i = entrees.length - 1; i >= 0; i--)
            if (entrees[i].mode === mode)
                return entrees[i];
        return undefined;
    };
    const demande = () => (derniere('voile') ? 'voile' : derniere('pastille') ? 'pastille' : null);
    // Le clavier s'arrête dès qu'un voile est demandé — pas seulement quand il
    // se dessine, 200 ms plus tard — et jusqu'à ce qu'il soit retiré.
    function garder() {
        if (rendu.garder)
            rendu.garder(reglages.clavier && (demande() === 'voile' || affiche === 'voile'));
    }
    function dessiner() {
        garder();
        if (!affiche) {
            montre = null;
            rendu.masquer();
            return;
        }
        // Pendant le temps minimum, plus rien n'attend : on garde la dernière phrase.
        const entree = derniere(affiche);
        if (entree)
            montre = { message: entree.message, detail: entree.detail };
        rendu.afficher(affiche, montre || { message: reglages[affiche], detail: null }, reglages.theme);
    }
    // Une visite qui en remplace une autre fait, dans le même tour, « fin » puis
    // « début » : on ne regarde qu'une fois le tour fini, comme Vue regroupe ses
    // mises à jour — sinon le chargeur clignoterait entre les deux.
    function planifier() {
        if (planifie)
            return;
        planifie = true;
        Promise.resolve().then(() => {
            planifie = false;
            evaluer();
        });
    }
    function evaluer() {
        const mode = demande();
        garder();
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
                    if (!m)
                        return garder();
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
        if (!affiche)
            return;
        const reste = Math.max(reglages.minimum - (Date.now() - afficheDepuis), reglages.grace);
        if (reste <= 0) {
            affiche = null;
            dessiner();
            return;
        }
        if (minuteurMasquage === undefined) {
            minuteurMasquage = setTimeout(() => {
                minuteurMasquage = undefined;
                if (demande())
                    return garder();
                affiche = null;
                dessiner();
            }, reste);
        }
    }
    function attendre(mode, attente = {}) {
        const entree = {
            mode,
            message: attente.message || reglages[mode],
            detail: mode === 'voile' && attente.detail ? attente.detail : null,
        };
        entrees.push(entree);
        planifier();
        let fini = false;
        return () => {
            if (fini)
                return;
            fini = true;
            const i = entrees.indexOf(entree);
            if (i >= 0)
                entrees.splice(i, 1);
            planifier();
        };
    }
    function suivre(promesse_1, attente_1) {
        return __awaiter(this, arguments, void 0, function* (promesse, attente, mode = 'pastille') {
            const fin = attendre(mode, typeof attente === 'string' ? { message: attente } : attente || {});
            try {
                return yield promesse;
            }
            finally {
                fin();
            }
        });
    }
    return {
        attendre,
        suivre,
        configurer(o) {
            appliquer(o);
            if (affiche)
                dessiner();
            else
                garder();
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
export function toucheBloquee(evenement) {
    if (evenement.ctrlKey || evenement.metaKey || evenement.altKey)
        return false;
    const touche = evenement.key || '';
    return touche !== 'Tab' && !/^F\d{1,2}$/.test(touche);
}
const EVENEMENTS_CLAVIER = ['keydown', 'keypress', 'keyup'];
/**
 * Le rendu dans la page : un bloc ajouté à la fin de `<body>`, hors de
 * l'application — Inertia remplace le contenu de `#app` à chaque visite, pas
 * celui de `<body>`. Créé à la première attente qui dure.
 */
export function renduDom() {
    let racine = null;
    let themeMonte = null;
    let elements = null;
    function monter(theme) {
        if (typeof document === 'undefined' || !document.body)
            return;
        injecterStyles();
        // Remonté si le thème change : les deux voitures portent le leur.
        if (!racine || themeMonte !== theme) {
            if (racine && racine.parentNode)
                racine.parentNode.removeChild(racine);
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
            const q = (sel) => racine.querySelector(sel);
            // Une pression sur le voile ne remonte pas jusqu'au document : une
            // modale ouverte dessous (Reka UI) la prendrait pour un clic à
            // l'extérieur, et se fermerait pendant l'écriture.
            const voile = q('.sta-voile');
            for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click']) {
                voile.addEventListener(type, (e) => e.stopPropagation());
            }
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
        if (!racine.parentNode)
            document.body.appendChild(racine);
    }
    // Tant que le voile est là, le clavier s'arrête à la fenêtre (phase de
    // capture) : rien n'atteint la page dessous.
    let clavierGarde = false;
    const garde = (evenement) => {
        if (!toucheBloquee(evenement))
            return;
        evenement.preventDefault();
        evenement.stopPropagation();
    };
    function garderClavier(actif) {
        if (actif === clavierGarde || typeof window === 'undefined' || typeof window.addEventListener !== 'function')
            return;
        clavierGarde = actif;
        for (const type of EVENEMENTS_CLAVIER) {
            if (actif)
                window.addEventListener(type, garde, true);
            else
                window.removeEventListener(type, garde, true);
        }
    }
    function basculer(el, visible) {
        const deja = el.className.indexOf('sta-visible') >= 0;
        if (visible && !deja)
            el.className += ' sta-visible';
        if (!visible && deja)
            el.className = el.className.replace(/\s*sta-visible/g, '');
    }
    return {
        afficher(mode, attente, theme) {
            monter(theme);
            if (!elements || !racine)
                return;
            // Une modale (Reka UI, Headless UI) cache aux lecteurs d'écran tout
            // ce qui n'est pas elle, nous compris : l'annonce serait muette.
            racine.removeAttribute('aria-hidden');
            racine.removeAttribute('inert');
            const { annonce, voile, message, detail, pastille, texte } = elements;
            if (mode === 'voile') {
                message.textContent = attente.message;
                detail.textContent = attente.detail || '';
                detail.style.display = attente.detail ? '' : 'none';
            }
            else {
                texte.textContent = attente.message;
            }
            basculer(voile, mode === 'voile');
            basculer(pastille, mode === 'pastille');
            if (annonce.textContent !== attente.message)
                annonce.textContent = attente.message;
        },
        masquer() {
            if (!elements)
                return;
            basculer(elements.voile, false);
            basculer(elements.pastille, false);
            elements.annonce.textContent = '';
        },
        garder(actif) {
            garderClavier(actif);
        },
    };
}
let instance = null;
/**
 * Le chargeur de la page, partagé par tous les branchements — et par deux
 * copies du paquet chargées dans la même page (une par bundle), qui se le
 * passent par `window`. Des options passées à un appel suivant s'appliquent
 * aussi, comme `chargeur().configurer(…)`.
 */
export function chargeur(options) {
    const fenetre = typeof window !== 'undefined' ? window : null;
    if (!instance)
        instance = (fenetre && fenetre.__staChargeur) || null;
    if (!instance) {
        instance = creerChargeur(options);
        if (fenetre)
            fenetre.__staChargeur = instance;
    }
    else if (options) {
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
export function suivre(promesse, attente, mode = 'pastille') {
    return chargeur().suivre(promesse, attente, mode);
}
