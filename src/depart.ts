import { chargeur, type Attente } from './chargeur.js';

/** Au-delà, le voile d'un départ se retire même si la page est restée là. */
export const SECURITE = 15000;

// Les départs en cours, tous branchements confondus.
const enCours: Array<() => void> = [];
let ecoute = false;

/**
 * Le voile jusqu'au départ de la page — un lien, un formulaire, une
 * redirection (Inertia vers une autre adresse, Livewire). La page qui s'en va
 * l'emporte avec elle ; celle qui reste — un téléchargement, un départ annulé —
 * le retire au bout de `securite`, et un retour arrière qui la ressort du
 * cache du navigateur le retire aussitôt.
 *
 * Rend la fonction qui le retire avant l'heure.
 */
export function attendreDepart(attente: Attente, securite: number = SECURITE): () => void {
    ecouterRetour();
    const terminer = chargeur().attendre('voile', attente);
    const fin = () => {
        const i = enCours.indexOf(fin);
        if (i >= 0) enCours.splice(i, 1);
        terminer();
    };
    enCours.push(fin);
    setTimeout(fin, securite);
    return fin;
}

/** Un départ est-il déjà sous le voile ? Un second ne ferait que changer sa phrase. */
export function departEnCours(): boolean {
    return enCours.length > 0;
}

// Retour arrière : le navigateur ressort la page de son cache, voile compris.
function ecouterRetour() {
    if (ecoute || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    ecoute = true;
    window.addEventListener('pageshow', (evenement: PageTransitionEvent) => {
        if (evenement.persisted) enCours.slice().forEach((fin) => fin());
    });
}
