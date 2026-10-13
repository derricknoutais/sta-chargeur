import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FEUILLE, voiture } from '../dist/index.js';

// Ce que le WebView Chrome 62 des terminaux Sunmi ignore ou ne comprend pas.
const INTERDITS = [
    [/(^|[;{\s])inset\s*:/, 'inset (Chrome 87)'],
    [/(^|[;{\s])(row-|column-)?gap\s*:/, 'gap en flexbox (Chrome 84)'],
    [/backdrop-filter/, 'backdrop-filter (Chrome 76)'],
    [/transform-box/, 'transform-box (Chrome 64)'],
    [/:is\(|:where\(/, ':is() / :where() (Chrome 88)'],
    [/clamp\(|\bmin\(|\bmax\(/, 'clamp() / min() / max() (Chrome 79)'],
    [/aspect-ratio/, 'aspect-ratio (Chrome 88)'],
    [/:focus-visible/, ':focus-visible (Chrome 86)'],
];

test('la feuille de style passe sur le WebView Chrome 62', () => {
    for (const [motif, nom] of INTERDITS) assert.doesNotMatch(FEUILLE, motif, nom);
});

test('le thème sombre se décline en classe, imposé et système', () => {
    assert.match(FEUILLE, /\.dark \.sta-voiture\.sta-theme-classe \.sta-caisse-bas\{stop-color:#3f84dc\}/);
    assert.match(FEUILLE, /\.sta-voiture\.sta-theme-sombre \.sta-caisse-bas\{stop-color:#3f84dc\}/);
    assert.match(FEUILLE, /@media \(prefers-color-scheme: dark\)\{[^@]*\.sta-voiture\.sta-theme-systeme \.sta-caisse-bas/);
    assert.match(FEUILLE, /\.dark \.sta-chargeur\.sta-theme-classe\{--sta-fond:/);
});

test('chaque voiture a ses propres dégradés', () => {
    const a = voiture({ largeur: 240 });
    const b = voiture({ largeur: 240 });
    const id = (svg) => svg.match(/id="(sta-v\d+)-caisse"/)[1];
    assert.notEqual(id(a), id(b));
    assert.ok(a.includes(`url(#${id(a)}-caisse)`));
    assert.ok(!a.includes(`url(#${id(b)}-caisse)`));
});

test('sans slogan, le cadre s’arrête à la route ; immobile, pas d’animation', () => {
    assert.match(voiture({ largeur: 64, slogan: false }), /viewBox="20 255 1360 373" width="64" height="18"/);
    assert.match(voiture({ largeur: 240 }), /viewBox="20 255 1360 470" width="240" height="83"/);
    assert.match(voiture({ largeur: 120, anime: false }), /class="sta-voiture sta-theme-classe sta-immobile"/);
    assert.match(FEUILLE, /\.sta-voiture\.sta-immobile \.sta-roue/);
});

test('le voile bloque même sous une modale qui coupe les clics de body', () => {
    assert.match(FEUILLE, /\.sta-chargeur \.sta-voile\{[^}]*pointer-events:auto/);
    assert.match(FEUILLE, /\.sta-chargeur \.sta-pastille\{[^}]*pointer-events:none/);
});
