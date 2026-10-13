import { mock } from 'node:test';

/** Un rendu qui note ce qu'on lui demande, au lieu de dessiner. */
export function faux() {
    const journal = [];
    return {
        journal,
        afficher(mode, attente, theme) {
            journal.push({ t: Date.now(), quoi: 'afficher', mode, message: attente.message, detail: attente.detail, theme });
        },
        masquer() {
            journal.push({ t: Date.now(), quoi: 'masquer' });
        },
    };
}

/** Vide la file des microtâches (le chargeur y regroupe ses mises à jour). */
export async function vider() {
    for (let i = 0; i < 5; i++) await Promise.resolve();
}

/**
 * Avance l'horloge simulée milliseconde par milliseconde, en laissant passer
 * les microtâches : `mock.timers.tick(n)` avance `Date` jusqu'au bout AVANT de
 * déclencher les minuteurs échus, qui liraient alors une heure fausse.
 */
export async function avancer(ms) {
    await vider();
    for (let i = 0; i < ms; i++) {
        mock.timers.tick(1);
        await vider();
    }
}

export function horloge() {
    mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
}

export function arreterHorloge() {
    mock.timers.reset();
}
