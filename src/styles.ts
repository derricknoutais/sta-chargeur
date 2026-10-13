/**
 * La feuille de style du chargeur, injectée une fois dans `<head>`.
 *
 * Écrite à la main, sans Tailwind : chaque application de la suite a le sien,
 * dans une version différente (1, 3 ou 4), et certaines n'en ont pas.
 *
 * ⚠️ Les terminaux Sunmi embarquent un WebView Chrome 62 : ni `inset`, ni `gap`
 * en flexbox, ni `backdrop-filter`, ni `transform-box`, ni `:is()`/`:where()`,
 * ni `clamp()`. Le test `test/styles.test.mjs` y veille.
 *
 * Couleurs de la carte et de la pastille : surchargeables par l'application
 * avec `--sta-chargeur-fond`, `--sta-chargeur-texte`, `--sta-chargeur-discret`,
 * `--sta-chargeur-ecran` (le voile derrière la carte) et `--sta-chargeur-z`
 * (le plan, 99999 par défaut).
 */

type Regles = Array<[selecteur: string, declarations: string]>;

/**
 * Les mêmes règles, appliquées dans les trois cas où le thème est sombre :
 * classe `dark` sur un ancêtre (thème `classe`), thème `sombre` imposé, ou
 * appareil réglé en sombre (thème `systeme`).
 */
function enSombre(racine: string, regles: Regles): string {
    const bloc = (prefixe: string) => regles.map(([sel, decl]) => `${sel ? `${prefixe} ${sel}` : prefixe}{${decl}}`).join('');

    return (
        bloc(`.dark ${racine}.sta-theme-classe`) +
        bloc(`${racine}.sta-theme-sombre`) +
        `@media (prefers-color-scheme: dark){${bloc(`${racine}.sta-theme-systeme`)}}`
    );
}

// Les couleurs du logo sur fond clair, relevées sur l'image officielle…
const VOITURE_CLAIR = `
.sta-voiture{display:block;overflow:visible}
.sta-voiture .sta-caisse-bas{stop-color:#06306f}
.sta-voiture .sta-caisse-haut{stop-color:#2a97e3}
.sta-voiture .sta-slogan-haut{stop-color:#1a70c3}
.sta-voiture .sta-slogan-bas{stop-color:#0a4997}
.sta-voiture .sta-roue-ar{fill:#083f8b}
.sta-voiture .sta-roue-av{fill:#105ba9}
.sta-voiture .sta-route-bord{stop-color:#9fb2c6;stop-opacity:0}
.sta-voiture .sta-route-plein{stop-color:#9fb2c6}
.sta-voiture .sta-fumee-coeur{stop-color:#8597aa;stop-opacity:.9}
.sta-voiture .sta-fumee-voile{stop-color:#9aabbd;stop-opacity:.6}
.sta-voiture .sta-fumee-bord{stop-color:#b8c6d3;stop-opacity:0}
.sta-voiture .sta-ombre-coeur{stop-color:#0d1c21;stop-opacity:.16}
.sta-voiture .sta-ombre-bord{stop-color:#0d1c21;stop-opacity:0}
.sta-voiture .sta-trait{stroke:#2a97e3}
`;

// … et éclaircies sur fond sombre, où le marine du logo disparaîtrait.
const VOITURE_SOMBRE: Regles = [
    ['.sta-caisse-bas', 'stop-color:#3f84dc'],
    ['.sta-caisse-haut', 'stop-color:#93d2ff'],
    ['.sta-slogan-haut', 'stop-color:#8dc3f5'],
    ['.sta-slogan-bas', 'stop-color:#5d97de'],
    ['.sta-roue-ar', 'fill:#4a8be0'],
    ['.sta-roue-av', 'fill:#62a3ec'],
    ['.sta-route-bord', 'stop-color:#5b6b78'],
    ['.sta-route-plein', 'stop-color:#5b6b78'],
    ['.sta-fumee-coeur', 'stop-color:#9aabbc;stop-opacity:.75'],
    ['.sta-fumee-voile', 'stop-color:#7d8fa1;stop-opacity:.45'],
    ['.sta-fumee-bord', 'stop-color:#5b6b78'],
    ['.sta-ombre-coeur', 'stop-color:#000000;stop-opacity:.5'],
    ['.sta-ombre-bord', 'stop-color:#000000'],
    ['.sta-trait', 'stroke:#93d2ff'],
];

// Le mouvement. Les roues font un tour en 0,8 s, la route défile d'un motif
// (70 + 50) en 0,28 s : à peu près la vitesse de la jante.
const MOUVEMENT = `
.sta-voiture .sta-roue{transform-origin:0 0;animation:sta-roue .8s linear infinite}
.sta-voiture .sta-caisse{animation:sta-caisse .36s ease-in-out infinite alternate}
.sta-voiture .sta-ombre{transform-origin:0 0;animation:sta-ombre .36s ease-in-out infinite alternate}
.sta-voiture .sta-route{stroke-width:6;stroke-dasharray:70 50;animation:sta-route .28s linear infinite}
.sta-voiture .sta-trait{stroke-width:8;stroke-linecap:round;opacity:0;animation:sta-vent .9s linear infinite}
.sta-voiture .sta-trait-2{animation-delay:-.3s}
.sta-voiture .sta-trait-3{animation-delay:-.6s}
.sta-voiture .sta-bouffee{opacity:0;transform-origin:0 0;animation:sta-fumee 1.6s linear infinite}
.sta-voiture .sta-bouffee-2{animation-delay:-.4s}
.sta-voiture .sta-bouffee-3{animation-delay:-.8s}
.sta-voiture .sta-bouffee-4{animation-delay:-1.2s}
@keyframes sta-roue{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes sta-caisse{from{transform:translateY(0)}to{transform:translateY(-6px)}}
@keyframes sta-ombre{from{transform:scale(1,1)}to{transform:scale(.94,.8)}}
@keyframes sta-route{from{stroke-dashoffset:0}to{stroke-dashoffset:120}}
@keyframes sta-vent{0%{opacity:0;transform:translateX(50px)}35%{opacity:.85}100%{opacity:0;transform:translateX(-90px)}}
@keyframes sta-fumee{0%{opacity:0;transform:translate(0,0) scale(.3)}8%{opacity:1}55%{opacity:.75}100%{opacity:0;transform:translate(-185px,-70px) scale(2.3)}}
`;

// À l'arrêt — un logo d'en-tête, ou pour qui a demandé moins d'animations :
// la voiture sans fumée ni vent.
const IMMOBILE = (prefixe: string) =>
    `${prefixe} .sta-roue,${prefixe} .sta-caisse,${prefixe} .sta-ombre,${prefixe} .sta-route{animation:none}${prefixe} .sta-sillage{display:none}`;

// La carte sous le voile et la pastille. Les couleurs passent par des
// variables, que l'application peut brancher sur ses propres jetons.
const CHARGEUR = `
.sta-chargeur{--sta-fond:#ffffff;--sta-texte:#14253a;--sta-discret:#5b6b78;--sta-ecran:rgba(13,28,33,.42)}
.sta-chargeur,.sta-chargeur *{box-sizing:border-box}
.sta-chargeur .sta-annonce{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.sta-chargeur .sta-voile{position:fixed;top:0;right:0;bottom:0;left:0;z-index:var(--sta-chargeur-z,99999);display:none;align-items:center;justify-content:center;padding:24px;background-color:var(--sta-chargeur-ecran,var(--sta-ecran))}
.sta-chargeur .sta-carte{display:flex;flex-direction:column;align-items:center;max-width:320px;margin:0;padding:22px 26px;border-radius:20px;background-color:var(--sta-chargeur-fond,var(--sta-fond));color:var(--sta-chargeur-texte,var(--sta-texte));text-align:center;box-shadow:0 24px 60px rgba(13,28,33,.28)}
.sta-chargeur .sta-message{margin:14px 0 0;padding:0;font-size:16px;font-weight:600;line-height:1.35;color:inherit}
.sta-chargeur .sta-detail{margin:6px 0 0;padding:0;font-size:13px;font-weight:400;line-height:1.5;color:var(--sta-chargeur-discret,var(--sta-discret))}
.sta-chargeur .sta-pastille{position:fixed;top:12px;left:50%;z-index:var(--sta-chargeur-z,99999);display:none;align-items:center;padding:7px 14px 7px 10px;border-radius:999px;background-color:var(--sta-chargeur-fond,var(--sta-fond));color:var(--sta-chargeur-texte,var(--sta-texte));box-shadow:0 8px 24px rgba(13,28,33,.18);pointer-events:none;transform:translateX(-50%)}
.sta-chargeur .sta-pastille-texte{margin-left:10px;font-size:13px;font-weight:600;line-height:1.3;white-space:nowrap}
.sta-chargeur .sta-voile.sta-visible,.sta-chargeur .sta-pastille.sta-visible{display:flex;animation:sta-apparition 160ms ease-out}
@keyframes sta-apparition{from{opacity:0}to{opacity:1}}
`;

const CHARGEUR_SOMBRE: Regles = [['', '--sta-fond:#13232b;--sta-texte:#e8eef2;--sta-discret:#9aabbd;--sta-ecran:rgba(0,0,0,.55)']];

/** Toute la feuille, pour qui préfère l'inclure lui-même (CSP stricte, par exemple). */
export const FEUILLE: string = [
    VOITURE_CLAIR,
    enSombre('.sta-voiture', VOITURE_SOMBRE),
    MOUVEMENT,
    IMMOBILE('.sta-voiture.sta-immobile'),
    CHARGEUR,
    enSombre('.sta-chargeur', CHARGEUR_SOMBRE),
    `@media (prefers-reduced-motion: reduce){${IMMOBILE('.sta-voiture')}.sta-chargeur .sta-visible{animation:none}}`,
]
    .join('\n')
    .replace(/\n+/g, '\n')
    .trim();

const ID = 'sta-chargeur-styles';

/** Injecte la feuille une fois par page. Sans effet hors navigateur (rendu serveur). */
export function injecterStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(ID)) return;

    const style = document.createElement('style');
    style.id = ID;
    style.textContent = FEUILLE;
    (document.head || document.documentElement).appendChild(style);
}
