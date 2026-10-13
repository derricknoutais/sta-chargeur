import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { arreterHorloge, avancer, horloge } from './outils.mjs';

globalThis.window = { location: new URL('https://fidbak.test/commandes') };
const { brancherAxios, chargeur } = await import('../dist/index.js');

beforeEach(horloge);
afterEach(arreterHorloge);

/** Un faux axios : des intercepteurs, et une requête qu'on termine à la main. */
function fauxAxios() {
    const pile = { request: [], response: [] };
    const intercepteurs = (nom) => ({
        use(succes, echec) {
            pile[nom].push({ succes, echec });
            return pile[nom].length - 1;
        },
        eject(id) {
            pile[nom][id] = null;
        },
    });
    return {
        interceptors: { request: intercepteurs('request'), response: intercepteurs('response') },
        envoyer(config) {
            let c = config;
            // axios exécute les intercepteurs de requête du dernier au premier.
            for (const i of pile.request.slice().reverse()) if (i) c = i.succes(c);
            return {
                reussir() {
                    let rep = { status: 200, config: c };
                    for (const i of pile.response) if (i) rep = i.succes(rep);
                    return rep;
                },
                echouer() {
                    const erreur = { message: 'Network Error', config: c };
                    for (const i of pile.response) if (i) i.echec(erreur).catch(() => {});
                },
                // axios 0.x : une annulation rejette un `Cancel` sans `.config`.
                annuler() {
                    for (const i of pile.response) if (i) i.echec({ message: 'annulée' }).catch(() => {});
                },
            };
        },
    };
}

test('GET : pastille « Chargement… » ; POST : voile « Enregistrement… »', async () => {
    const axios = fauxAxios();
    const debrancher = brancherAxios(axios);
    const lecture = axios.envoyer({ method: 'get', url: '/api/commandes', headers: {} });
    await avancer(300);
    assert.deepEqual(chargeur().etat(), { affiche: 'pastille', voiles: 0, pastilles: 1, message: 'Chargement…' });
    const ecriture = axios.envoyer({ method: 'post', url: '/api/commandes', headers: {} });
    await avancer(10);
    assert.deepEqual(chargeur().etat(), { affiche: 'voile', voiles: 1, pastilles: 1, message: 'Enregistrement…' });
    lecture.reussir();
    ecriture.echouer();
    await avancer(1000);
    assert.deepEqual(chargeur().etat(), { affiche: null, voiles: 0, pastilles: 0, message: null });
    debrancher();
});

test('les visites Inertia (en-tête X-Inertia) sont laissées à brancherInertia', async () => {
    const axios = fauxAxios();
    const debrancher = brancherAxios(axios);
    // axios 0.x : un objet simple ; axios 1.x : un AxiosHeaders, lu par get().
    axios.envoyer({ method: 'get', url: '/', headers: { 'X-Inertia': true } });
    axios.envoyer({ method: 'get', url: '/', headers: { get: (n) => (n === 'X-Inertia' ? 'true' : undefined) } });
    await avancer(300);
    assert.equal(chargeur().etat().pastilles, 0);
    debrancher();
});

test('réglage par requête : staChargeur false, mode et message imposés', async () => {
    const axios = fauxAxios();
    const debrancher = brancherAxios(axios);
    const muette = axios.envoyer({ method: 'get', url: '/notifications', staChargeur: false });
    const imposee = axios.envoyer({ method: 'get', url: '/stock', staChargeur: { mode: 'voile', message: 'Lecture du stock…' } });
    await avancer(300);
    assert.deepEqual(chargeur().etat(), { affiche: 'voile', voiles: 1, pastilles: 0, message: 'Lecture du stock…' });
    muette.reussir();
    imposee.reussir();
    await avancer(1000);
    assert.equal(chargeur().etat().affiche, null);
    debrancher();
});

test("une copie de la configuration par un autre intercepteur n'égare pas la fin", async () => {
    const axios = fauxAxios();
    // Posé avant le nôtre, donc exécuté après lui : il reçoit notre
    // configuration et en rend une copie.
    axios.interceptors.request.use((c) => ({ ...c, copie: true }));
    const debrancher = brancherAxios(axios);
    const requete = axios.envoyer({ method: 'delete', url: '/api/x', headers: {} });
    await avancer(300);
    assert.equal(chargeur().etat().message, 'Suppression…');
    requete.reussir();
    await avancer(1000);
    assert.equal(chargeur().etat().voiles, 0);
    debrancher();
});

test('classer et decrire, pour toute l’application', async () => {
    const axios = fauxAxios();
    const debrancher = brancherAxios(axios, {
        classer: (r, parDefaut) => (r.url === '/api/ping' ? null : parDefaut),
        decrire: (r) => (r.url.startsWith('/api/qbo') ? { message: 'Écriture dans QuickBooks…' } : null),
    });
    const ping = axios.envoyer({ method: 'get', url: '/api/ping', headers: {} });
    const qbo = axios.envoyer({ method: 'post', url: '/api/qbo/ecritures', headers: {} });
    await avancer(300);
    assert.deepEqual(chargeur().etat(), { affiche: 'voile', voiles: 1, pastilles: 0, message: 'Écriture dans QuickBooks…' });
    ping.reussir();
    qbo.reussir();
    await avancer(1000);
    debrancher();
});

test("une requête annulée (axios 0.x : Cancel sans config) ne laisse pas le voile coincé", async () => {
    const axios = fauxAxios();
    const debrancher = brancherAxios(axios);
    let annuler;
    const jeton = { promise: new Promise((r) => (annuler = r)) };
    const requete = axios.envoyer({ method: 'post', url: '/api/x', headers: {}, cancelToken: jeton });
    await avancer(300);
    assert.equal(chargeur().etat().voiles, 1);
    annuler({ message: 'annulée' });
    requete.annuler();
    await avancer(1000);
    assert.deepEqual(chargeur().etat(), { affiche: null, voiles: 0, pastilles: 0, message: null });
    debrancher();
});

test('un signal AbortController, déjà levé ou levé en vol, ferme l’attente', async () => {
    const axios = fauxAxios();
    const debrancher = brancherAxios(axios);
    const ecouteurs = [];
    const signal = { aborted: false, addEventListener: (t, f) => ecouteurs.push(f) };
    axios.envoyer({ method: 'get', url: '/a', headers: {}, signal });
    axios.envoyer({ method: 'get', url: '/b', headers: {}, signal: { aborted: true, addEventListener() {} } });
    await avancer(300);
    assert.equal(chargeur().etat().pastilles, 1);
    ecouteurs.forEach((f) => f());
    await avancer(1000);
    assert.equal(chargeur().etat().pastilles, 0);
    debrancher();
});
