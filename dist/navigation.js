import { chargeur } from './chargeur.js';
/** Ce qui écarte un lien ou un formulaire : `data-sta-chargeur="non"` sur lui ou un ancêtre. */
export const REFUS = '[data-sta-chargeur="non"]';
// Un fichier qu'on télécharge ne quitte pas la page.
const FICHIER = /\.(pdf|csv|xlsx?|ods|docx?|odt|pptx?|zip|rar|7z|gz|png|jpe?g|gif|webp|svg|txt|json|xml|apk|mp3|mp4)$/i;
function adresse(brute, ici) {
    try {
        const url = new URL(brute, ici.href);
        if (url.protocol !== 'http:' && url.protocol !== 'https:')
            return null;
        // Un autre site : on quitte l'application, ce n'est plus son attente.
        if (url.origin !== ici.origin)
            return null;
        if (FICHIER.test(url.pathname))
            return null;
        return url;
    }
    catch (_a) {
        return null;
    }
}
/** L'adresse vers laquelle part ce clic, ou `null` s'il ne change pas de page. */
export function departParLien(lien, clic, ici) {
    if (clic.defaultPrevented)
        return null;
    // Un nouvel onglet, une nouvelle fenêtre : cette page-ci reste.
    if ((clic.button !== undefined && clic.button !== 0) || clic.ctrlKey || clic.metaKey || clic.shiftKey || clic.altKey)
        return null;
    if (lien.target && lien.target !== '_self')
        return null;
    if (lien.hasAttribute('download') || lien.closest(REFUS))
        return null;
    const brut = lien.getAttribute('href');
    if (brut === null || brut === '' || brut.charAt(0) === '#')
        return null;
    const url = adresse(lien.href || brut, ici);
    if (!url)
        return null;
    // Une ancre dans la page.
    if (url.hash && url.pathname === ici.pathname && url.search === ici.search)
        return null;
    return url;
}
/** Où et comment part ce formulaire, ou `null` s'il ne change pas de page. */
export function departParFormulaire(formulaire, envoi, ici) {
    if (envoi.defaultPrevented)
        return null;
    // Par les attributs : un champ nommé `action` ou `target` masquerait les
    // propriétés du même nom.
    const cible = formulaire.getAttribute('target');
    if (cible && cible !== '_self')
        return null;
    if (formulaire.closest(REFUS))
        return null;
    const url = adresse(formulaire.getAttribute('action') || ici.href, ici);
    if (!url)
        return null;
    let methode = (formulaire.getAttribute('method') || 'get').toLowerCase();
    // Laravel simule PUT, PATCH et DELETE par un champ caché `_method`.
    const champs = formulaire.elements;
    const simule = champs && typeof champs.namedItem === 'function' ? champs.namedItem('_method') : null;
    if (methode === 'post' && simule && simule.value)
        methode = simule.value.toLowerCase();
    return { url, methode };
}
function messageParDefaut(navigation) {
    if (navigation.methode === 'get')
        return 'Chargement…';
    if (navigation.methode === 'delete')
        return 'Suppression…';
    return 'Enregistrement…';
}
/**
 * Pour les pages classiques (Blade) : montre le voile quand on quitte la page
 * par un lien ou un formulaire, le temps que la suivante arrive.
 *
 * Écartés d'office : les clics et envois déjà interceptés par l'application
 * (`preventDefault` — Vue, Livewire, Inertia), les nouveaux onglets, les ancres,
 * les autres sites, les fichiers et les liens `download`. Pour écarter le
 * reste — un export qui télécharge sans le dire — `data-sta-chargeur="non"`
 * sur le lien, le formulaire ou un ancêtre.
 *
 * Rend la fonction qui débranche.
 */
export function brancherNavigation(options = {}) {
    if (typeof document === 'undefined')
        return () => { };
    const { liens = true, formulaires = true, securite = 15000 } = options;
    const enCours = [];
    function partir(navigation) {
        const decrit = (options.decrire && options.decrire(navigation)) || {};
        const terminer = chargeur().attendre('voile', { message: decrit.message || messageParDefaut(navigation), detail: decrit.detail });
        const fin = () => {
            const i = enCours.indexOf(fin);
            if (i >= 0)
                enCours.splice(i, 1);
            terminer();
        };
        enCours.push(fin);
        setTimeout(fin, securite);
    }
    // On regarde une fois l'événement entièrement distribué : un gestionnaire
    // posé après le nôtre (jQuery délégué sur `document`, par exemple) peut
    // encore l'annuler.
    const surClic = (evenement) => {
        const cible = evenement.target;
        const lien = cible && typeof cible.closest === 'function' ? cible.closest('a[href]') : null;
        if (!lien)
            return;
        setTimeout(() => {
            const url = departParLien(lien, evenement, window.location);
            if (url)
                partir({ type: 'lien', methode: 'get', url, element: lien });
        }, 0);
    };
    const surEnvoi = (evenement) => {
        const formulaire = evenement.target;
        if (!formulaire || formulaire.tagName !== 'FORM')
            return;
        setTimeout(() => {
            const depart = departParFormulaire(formulaire, evenement, window.location);
            if (depart)
                partir({ type: 'formulaire', methode: depart.methode, url: depart.url, element: formulaire });
        }, 0);
    };
    // Retour arrière : le navigateur ressort la page de son cache, voile compris.
    const surRetour = (evenement) => {
        if (!evenement.persisted)
            return;
        enCours.slice().forEach((fin) => fin());
    };
    if (liens)
        document.addEventListener('click', surClic);
    if (formulaires)
        document.addEventListener('submit', surEnvoi);
    window.addEventListener('pageshow', surRetour);
    return () => {
        document.removeEventListener('click', surClic);
        document.removeEventListener('submit', surEnvoi);
        window.removeEventListener('pageshow', surRetour);
        enCours.slice().forEach((fin) => fin());
    };
}
