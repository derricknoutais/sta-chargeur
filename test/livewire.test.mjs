import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { arreterHorloge, avancer, horloge } from './outils.mjs';

globalThis.window = { location: new URL('https://rentalpro.test/contrats') };
// Les envois de fichiers s'écoutent sur document.
const ecouteurs = {};
globalThis.document = {
    addEventListener: (n, f) => ((ecouteurs[n] = ecouteurs[n] || []).push(f)),
    removeEventListener: (n, f) => (ecouteurs[n] = (ecouteurs[n] || []).filter((g) => g !== f)),
    getElementById: () => null,
    body: null,
};
const { brancherLivewire, chargeur } = await import('../dist/index.js');

beforeEach(horloge);
afterEach(arreterHorloge);

/** Un faux Livewire 2 : des crochets qu'on déclenche à la main. */
function fauxLivewire() {
    const crochets = {};
    return {
        hook: (nom, rappel) => (crochets[nom] = crochets[nom] || []).push(rappel),
        declencher: (nom, ...args) => (crochets[nom] || []).forEach((r) => r(...args)),
    };
}
const message = (...actions) => ({ updateQueue: actions, component: { name: 'contrats.liste' } });
const appel = (method) => ({ type: 'callMethod', payload: { method } });
const champ = (name) => ({ type: 'syncInput', payload: { name } });

test('une méthode de l’application : voile ; un champ ou la pagination : pastille', async () => {
    const lw = fauxLivewire();
    const debrancher = brancherLivewire(lw);
    const saisie = message(champ('recherche'));
    lw.declencher('message.sent', saisie, { name: 'contrats.liste' });
    await avancer(300);
    assert.equal(chargeur().etat().affiche, 'pastille');
    lw.declencher('message.processed', saisie);

    const page = message(appel('nextPage'));
    lw.declencher('message.sent', page);
    await avancer(10);
    assert.equal(chargeur().etat().pastilles, 1);
    lw.declencher('message.processed', page);

    const enregistrement = message(champ('montant'), appel('enregistrer'));
    lw.declencher('message.sent', enregistrement);
    await avancer(300);
    assert.equal(chargeur().etat().affiche, 'voile');
    lw.declencher('message.failed', enregistrement);
    await avancer(1000);
    assert.deepEqual(chargeur().etat(), { affiche: null, voiles: 0, pastilles: 0, message: null });
    debrancher();
});

test('une redirection garde le voile jusqu’au départ, au plus le délai de sécurité', async () => {
    const lw = fauxLivewire();
    const debrancher = brancherLivewire(lw, { securite: 2000 });
    const m = message(appel('enregistrer'));
    lw.declencher('message.sent', m);
    await avancer(300);
    m.response = { effects: { redirect: '/contrats/9' } };
    lw.declencher('message.received', m);
    lw.declencher('message.processed', m);
    await avancer(1000);
    assert.equal(chargeur().etat().affiche, 'voile');
    await avancer(1500);
    assert.equal(chargeur().etat().affiche, null);
    debrancher();
});

test('classer peut faire taire un polling', async () => {
    const lw = fauxLivewire();
    const debrancher = brancherLivewire(lw, { classer: (e, parDefaut) => (e.appels.indexOf('rafraichirTableau') >= 0 ? null : parDefaut) });
    lw.declencher('message.sent', message(appel('rafraichirTableau')));
    await avancer(300);
    assert.equal(chargeur().etat().voiles, 0);
    debrancher();
});

test('les envois de fichiers montrent la pastille', async () => {
    const lw = fauxLivewire();
    const debrancher = brancherLivewire(lw);
    const champFichier = {};
    ecouteurs['livewire-upload-start'].forEach((f) => f({ target: champFichier }));
    await avancer(300);
    assert.deepEqual(chargeur().etat(), { affiche: 'pastille', voiles: 0, pastilles: 1, message: 'Envoi du fichier…' });
    ecouteurs['livewire-upload-finish'].forEach((f) => f({ target: champFichier }));
    await avancer(1000);
    assert.equal(chargeur().etat().affiche, null);
    debrancher();
});

test('Livewire 3 est signalé et laissé tranquille', () => {
    const avertissements = [];
    const original = console.warn;
    console.warn = (m) => avertissements.push(m);
    const lw = { ...fauxLivewire(), navigate: () => {} };
    brancherLivewire(lw)();
    console.warn = original;
    assert.match(avertissements[0], /Livewire 3/);
});
