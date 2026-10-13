import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { creerChargeur } from '../dist/index.js';
import { arreterHorloge, avancer, faux, horloge, vider } from './outils.mjs';

beforeEach(horloge);
afterEach(arreterHorloge);

const resume = (journal) => journal.map((e) => (e.quoi === 'afficher' ? `${e.t} ${e.mode} ${e.message}` : `${e.t} masquer`));

test('une attente brève ne montre rien', async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    const fin = c.attendre('voile');
    await avancer(120);
    fin();
    await avancer(1000);
    assert.deepEqual(rendu.journal, []);
});

test('une attente longue : affichée à 200 ms, retirée à la fin', async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    const fin = c.attendre('voile', { message: 'Écriture dans Lightspeed…', detail: 'Ne quittez pas cette page.' });
    await avancer(1500);
    fin();
    await avancer(10);
    assert.deepEqual(resume(rendu.journal), ['200 voile Écriture dans Lightspeed…', '1500 masquer']);
    assert.equal(rendu.journal[0].detail, 'Ne quittez pas cette page.');
});

test('une fois affiché, il reste au moins 450 ms', async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    const fin = c.attendre('voile');
    await avancer(260);
    fin();
    await avancer(1000);
    assert.deepEqual(resume(rendu.journal), ['200 voile Chargement…', '650 masquer']);
});

test("une visite qui en remplace une autre ne fait pas clignoter", async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    const a = c.attendre('voile', { message: 'A' });
    await avancer(500);
    // Dans le même tour : la fin de A, le début de B.
    a();
    const b = c.attendre('voile', { message: 'B' });
    await avancer(500);
    b();
    await avancer(10);
    assert.deepEqual(resume(rendu.journal), ['200 voile A', '500 voile B', '1000 masquer']);
});

test('un voile qui succède à la pastille la remplace aussitôt', async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    const p = c.attendre('pastille', { message: 'Recherche…' });
    await avancer(300);
    const v = c.attendre('voile', { message: 'Lancement…' });
    await avancer(400);
    v();
    await avancer(100);
    p();
    await avancer(1000);
    assert.deepEqual(resume(rendu.journal), ['200 pastille Recherche…', '300 voile Lancement…', '700 pastille Recherche…', '800 masquer']);
});

test("la plus récente des attentes parle ; quand elle finit, la précédente reprend", async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    const a = c.attendre('voile', { message: 'Ouverture de la session…' });
    await avancer(250);
    const b = c.attendre('voile', { message: 'Enregistrement…' });
    await avancer(100);
    b();
    await avancer(100);
    a();
    await avancer(1000);
    assert.deepEqual(resume(rendu.journal), [
        '200 voile Ouverture de la session…',
        '250 voile Enregistrement…',
        '350 voile Ouverture de la session…',
        '650 masquer',
    ]);
});

test('terminer deux fois ne retire pas une autre attente', async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    const a = c.attendre('voile', { message: 'A' });
    const b = c.attendre('voile', { message: 'B' });
    a();
    a();
    await avancer(300);
    assert.equal(c.etat().voiles, 1);
    assert.equal(c.etat().affiche, 'voile');
    b();
    await avancer(1000);
    assert.equal(c.etat().affiche, null);
});

test('suivre rend la promesse telle quelle, résolue ou rejetée', async () => {
    const c = creerChargeur({}, faux());
    assert.equal(await c.suivre(Promise.resolve(42)), 42);
    await assert.rejects(c.suivre(Promise.reject(new Error('panne'))), /panne/);
    await vider();
    assert.equal(c.etat().pastilles, 0);
});

test('suivre montre la pastille avec son message pendant la promesse', async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    let resoudre;
    const promesse = c.suivre(new Promise((r) => (resoudre = r)), 'Lecture du code…');
    await avancer(300);
    resoudre('ok');
    assert.equal(await promesse, 'ok');
    await avancer(1000);
    assert.deepEqual(resume(rendu.journal), ['200 pastille Lecture du code…', '650 masquer']);
});

test('les délais, le thème et les messages se règlent', async () => {
    const rendu = faux();
    const c = creerChargeur({ delai: 50, minimum: 100, theme: 'sombre', messages: { voile: 'Patientez…' } }, rendu);
    const fin = c.attendre('voile');
    await avancer(60);
    fin();
    await avancer(500);
    assert.deepEqual(resume(rendu.journal), ['50 voile Patientez…', '150 masquer']);
    assert.equal(rendu.journal[0].theme, 'sombre');
});

test('suivre accepte une phrase et un détail, sous le voile', async () => {
    const rendu = faux();
    const c = creerChargeur({}, rendu);
    let resoudre;
    const promesse = c.suivre(new Promise((r) => (resoudre = r)), { message: 'Synchronisation avec QuickBooks…', detail: 'Ne quittez pas.' }, 'voile');
    await avancer(300);
    resoudre();
    await promesse;
    await avancer(1000);
    assert.deepEqual(resume(rendu.journal), ['200 voile Synchronisation avec QuickBooks…', '650 masquer']);
    assert.equal(rendu.journal[0].detail, 'Ne quittez pas.');
});
