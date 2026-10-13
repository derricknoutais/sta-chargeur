import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { arreterHorloge, avancer, horloge } from './outils.mjs';

// Le stockage de session où Inertia note une redirection (`inertiaLocationVisit`).
const stockage = new Map();
globalThis.window = {
    location: new URL('https://storit.test/revue/19'),
    sessionStorage: { getItem: (c) => (stockage.has(c) ? stockage.get(c) : null), setItem: (c, v) => stockage.set(c, v), removeItem: (c) => stockage.delete(c) },
};
const { brancherInertia, chargeur } = await import('../dist/index.js');

beforeEach(horloge);
afterEach(arreterHorloge);

/**
 * Un faux routeur. `copie` : comme Inertia 1, `finish` reçoit une copie de la
 * visite (`{ ...visite }`) ; sinon le même objet, comme Inertia 2 et 3.
 */
function routeur({ copie = false } = {}) {
    const ecouteurs = { start: [], finish: [] };
    return {
        on(nom, rappel) {
            ecouteurs[nom].push(rappel);
            return () => (ecouteurs[nom] = ecouteurs[nom].filter((r) => r !== rappel));
        },
        visiter(champs) {
            const visite = { method: 'get', showProgress: true, prefetch: false, ...champs, url: new URL(champs.url, 'https://storit.test') };
            ecouteurs.start.forEach((r) => r({ detail: { visit: visite } }));
            const active = copie ? { ...visite, cancelToken: {} } : visite;
            return () => ecouteurs.finish.forEach((r) => r({ detail: { visit: active } }));
        },
    };
}

async function attendreFin() {
    await avancer(1000);
    assert.equal(chargeur().etat().affiche, null);
}

for (const [version, copie] of [
    ['Inertia 1 (finish reçoit une copie)', true],
    ['Inertia 2 et 3 (même objet)', false],
]) {
    test(`${version} : voile pendant une visite vers une autre page, retiré à la fin`, async () => {
        const r = routeur({ copie });
        const debrancher = brancherInertia(r);
        const fin = r.visiter({ url: '/comptage/12' });
        await avancer(300);
        assert.equal(chargeur().etat().affiche, 'voile');
        fin();
        await attendreFin();
        debrancher();
    });
}

test('un GET vers la page affichée (filtre, pagination) : pastille', async () => {
    const r = routeur();
    const debrancher = brancherInertia(r);
    const fin = r.visiter({ url: '/revue/19?page=2' });
    await avancer(300);
    assert.equal(chargeur().etat().affiche, 'pastille');
    fin();
    await attendreFin();
    debrancher();
});

test('préchargement et visites sans progression : rien', async () => {
    const r = routeur();
    const debrancher = brancherInertia(r);
    const a = r.visiter({ url: '/comptage/3', prefetch: true });
    const b = r.visiter({ url: '/comptage/4', showProgress: false });
    await avancer(300);
    assert.equal(chargeur().etat().affiche, null);
    assert.equal(chargeur().etat().voiles, 0);
    a();
    b();
    debrancher();
});

test("Inertia 1 n'a ni prefetch ni showProgress : ses visites comptent", async () => {
    const r = routeur({ copie: true });
    const debrancher = brancherInertia(r);
    const fin = r.visiter({ url: '/sync', method: 'post', showProgress: undefined, prefetch: undefined });
    await avancer(300);
    assert.equal(chargeur().etat().affiche, 'voile');
    fin();
    await attendreFin();
    debrancher();
});

test("decrire donne le message, classer peut écarter une visite", async () => {
    const r = routeur();
    const debrancher = brancherInertia(r, {
        decrire: (v) => (v.methode === 'post' && /\/valider$/.test(v.chemin) ? { message: 'Écriture dans Lightspeed…', detail: 'Ne quittez pas.' } : null),
        classer: (v, parDefaut) => (v.chemin === '/etat-sync' ? null : parDefaut),
    });
    const a = r.visiter({ url: '/revue/19/valider', method: 'post' });
    const b = r.visiter({ url: '/etat-sync' });
    await avancer(300);
    assert.deepEqual(chargeur().etat(), { affiche: 'voile', voiles: 1, pastilles: 0, message: 'Écriture dans Lightspeed…' });
    a();
    b();
    await attendreFin();
    debrancher();
});

test('une visite interrompue par la suivante ne laisse rien derrière elle', async () => {
    const r = routeur({ copie: true });
    const debrancher = brancherInertia(r);
    const a = r.visiter({ url: '/a' });
    await avancer(250);
    a();
    const b = r.visiter({ url: '/b' });
    await avancer(250);
    b();
    await attendreFin();
    assert.equal(chargeur().etat().voiles, 0);
    debrancher();
});

test('débrancher retire les écouteurs', async () => {
    const r = routeur();
    brancherInertia(r)();
    const fin = r.visiter({ url: '/x' });
    await avancer(300);
    assert.equal(chargeur().etat().affiche, null);
    fin();
});

test("une redirection vers une autre adresse (409) garde le voile jusqu'au départ", async () => {
    const r = routeur({ copie: true });
    const debrancher = brancherInertia(r, { securite: 3000 });
    const fin = r.visiter({ url: '/login', method: 'post' });
    await avancer(300);
    // Inertia note la redirection puis change window.location ; la visite finit.
    stockage.set('inertiaLocationVisit', '{"preserveScroll":false}');
    fin();
    await avancer(1000);
    assert.deepEqual(chargeur().etat(), { affiche: 'voile', voiles: 1, pastilles: 0, message: 'Redirection…' });
    // La page n'est pas partie (un téléchargement) : la sécurité retire le voile.
    await avancer(2500);
    assert.equal(chargeur().etat().affiche, null);
    stockage.clear();
    debrancher();
});

test("une marque laissée par une redirection plus ancienne ne compte pas", async () => {
    stockage.set('inertiaLocationVisit', '{"preserveScroll":false}');
    const r = routeur();
    const debrancher = brancherInertia(r);
    const fin = r.visiter({ url: '/a' });
    await avancer(300);
    fin();
    await avancer(1000);
    assert.equal(chargeur().etat().affiche, null);
    stockage.clear();
    debrancher();
});

test("sans phrase de l'application, celle de la méthode", async () => {
    const r = routeur();
    const debrancher = brancherInertia(r);
    const a = r.visiter({ url: '/clients', method: 'post' });
    await avancer(300);
    assert.equal(chargeur().etat().message, 'Enregistrement…');
    const b = r.visiter({ url: '/clients/3', method: 'delete' });
    await avancer(10);
    assert.equal(chargeur().etat().message, 'Suppression…');
    a();
    b();
    await avancer(1000);
    const c = r.visiter({ url: '/clients' });
    await avancer(300);
    assert.equal(chargeur().etat().message, 'Chargement…');
    c();
    await avancer(1000);
    debrancher();
});
