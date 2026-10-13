import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attenteDeclaree, departParCode, departParFormulaire, departParLien } from '../dist/index.js';

const ici = new URL('https://shipper.test/commandes?statut=ouvertes');

/** Un faux lien : ses attributs, et un ancêtre qui refuse ou non. */
function lien(href, attributs = {}, { refuse = false } = {}) {
    return {
        href: new URL(href, ici).href,
        target: attributs.target || '',
        getAttribute: (n) => (n === 'href' ? href : attributs[n] !== undefined ? attributs[n] : null),
        hasAttribute: (n) => n in attributs,
        closest: () => (refuse ? {} : null),
    };
}
const clic = (champs = {}) => ({ defaultPrevented: false, button: 0, ...champs });

test('un lien vers une autre page de l’application part', () => {
    assert.equal(departParLien(lien('/commandes/12'), clic(), ici).pathname, '/commandes/12');
    assert.equal(departParLien(lien('/commandes?statut=livrees'), clic(), ici).search, '?statut=livrees');
});

test('restent sur place : clic intercepté, nouvel onglet, ancre, autre site, fichier, download, refus', () => {
    assert.equal(departParLien(lien('/a'), clic({ defaultPrevented: true }), ici), null);
    assert.equal(departParLien(lien('/a'), clic({ ctrlKey: true }), ici), null);
    assert.equal(departParLien(lien('/a'), clic({ metaKey: true }), ici), null);
    assert.equal(departParLien(lien('/a'), clic({ button: 1 }), ici), null);
    assert.equal(departParLien(lien('/a', { target: '_blank' }), clic(), ici), null);
    assert.equal(departParLien(lien('#haut'), clic(), ici), null);
    assert.equal(departParLien(lien('/commandes?statut=ouvertes#ligne-3'), clic(), ici), null);
    assert.equal(departParLien(lien('https://pulldb.stapog.com/'), clic(), ici), null);
    assert.equal(departParLien(lien('mailto:compta@sta.ga'), clic(), ici), null);
    assert.equal(departParLien(lien('javascript:void(0)'), clic(), ici), null);
    assert.equal(departParLien(lien('/exports/commandes.xlsx'), clic(), ici), null);
    assert.equal(departParLien(lien('/factures/12.PDF'), clic(), ici), null);
    assert.equal(departParLien(lien('/export', { download: '' }), clic(), ici), null);
    assert.equal(departParLien(lien('/export', {}, { refuse: true }), clic(), ici), null);
});

test('target="_self" part comme un lien ordinaire', () => {
    assert.notEqual(departParLien(lien('/a', { target: '_self' }), clic(), ici), null);
});

/** Un faux formulaire. */
function formulaire(attributs = {}, { methodeSimulee = null, refuse = false } = {}) {
    return {
        getAttribute: (n) => (attributs[n] !== undefined ? attributs[n] : null),
        hasAttribute: (n) => n in attributs,
        closest: () => (refuse ? {} : null),
        elements: { namedItem: (n) => (n === '_method' && methodeSimulee ? { value: methodeSimulee } : null) },
    };
}

test('un formulaire part vers son action, avec sa méthode — ou celle que simule Laravel', () => {
    assert.deepEqual(departParFormulaire(formulaire({ action: '/commandes', method: 'POST' }), { defaultPrevented: false }, ici).methode, 'post');
    assert.equal(departParFormulaire(formulaire({ action: '/commandes/3', method: 'post' }, { methodeSimulee: 'DELETE' }), { defaultPrevented: false }, ici).methode, 'delete');
    const recherche = departParFormulaire(formulaire({}), { defaultPrevented: false }, ici);
    assert.equal(recherche.methode, 'get');
    assert.equal(recherche.url.pathname, '/commandes');
});

test('restent sur place : envoi intercepté (Vue, Livewire), autre fenêtre, autre site, refus', () => {
    assert.equal(departParFormulaire(formulaire({ action: '/a', method: 'post' }), { defaultPrevented: true }, ici), null);
    assert.equal(departParFormulaire(formulaire({ action: '/a', target: '_blank' }), { defaultPrevented: false }, ici), null);
    assert.equal(departParFormulaire(formulaire({ action: 'https://paiement.example/' }), { defaultPrevented: false }, ici), null);
    assert.equal(departParFormulaire(formulaire({ action: '/a' }, { refuse: true }), { defaultPrevented: false }, ici), null);
});

/** Un faux élément du DOM : ses attributs, et ses ancêtres pour closest(). */
function element(attributs = {}, parent = null) {
    const el = {
        getAttribute: (n) => (n in attributs ? attributs[n] : null),
        closest: (sel) => {
            const nom = sel.slice(1, -1);
            for (let e = el; e; e = e.parent) if (e.a && nom in e.a) return e;
            return null;
        },
        a: attributs,
        parent,
    };
    return el;
}

test('les messages posés dans la page : le plus proche l’emporte, bouton d’envoi d’abord', () => {
    const page = element({ 'data-sta-chargeur-detail': 'Retour vers Storit.' });
    const formulaire = element({ 'data-sta-chargeur-message': 'Envoi…' }, page);
    const bouton = element({ 'data-sta-chargeur-message': 'Autorisation en cours…' }, formulaire);
    assert.deepEqual(attenteDeclaree(bouton, formulaire), { message: 'Autorisation en cours…', detail: 'Retour vers Storit.' });
    assert.deepEqual(attenteDeclaree(null, formulaire), { message: 'Envoi…', detail: 'Retour vers Storit.' });
    assert.deepEqual(attenteDeclaree(element()), { message: undefined, detail: undefined });
});

/** Un faux événement `navigate` de l'API Navigation. */
const navigate = (champs = {}) => ({ userInitiated: false, hashChange: false, navigationType: 'push', downloadRequest: null, formData: null, destination: { url: 'https://shipper.test/commandes/12', sameDocument: false }, ...champs });

test('un départ lancé par le code (location.href, reload, form.submit) part', () => {
    assert.deepEqual(departParCode(navigate(), ici).methode, 'get');
    assert.equal(departParCode(navigate({ navigationType: 'reload', destination: { url: ici.href, sameDocument: false } }), ici).rechargement, true);
    assert.equal(departParCode(navigate({ formData: {} }), ici).methode, 'post');
});

test("restent au code de l'application ou sur place : clic de l'utilisateur, ancre, même document, téléchargement, autre site, fichier, traverse", () => {
    assert.equal(departParCode(navigate({ userInitiated: true }), ici), null);
    assert.equal(departParCode(navigate({ hashChange: true }), ici), null);
    assert.equal(departParCode(navigate({ destination: { url: 'https://shipper.test/x', sameDocument: true } }), ici), null);
    assert.equal(departParCode(navigate({ downloadRequest: 'export.xlsx' }), ici), null);
    assert.equal(departParCode(navigate({ destination: { url: 'https://stapog.test/oauth', sameDocument: false } }), ici), null);
    assert.equal(departParCode(navigate({ destination: { url: 'https://shipper.test/exports/bons.xlsx', sameDocument: false } }), ici), null);
    assert.equal(departParCode(navigate({ navigationType: 'traverse' }), ici), null);
});
