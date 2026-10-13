import { injecterStyles } from './styles.js';
import { CAISSE, ROUE_ARRIERE, ROUE_AVANT, SLOGAN } from './traces.js';
// Deux logos dans la page avec les mêmes noms de dégradés : le second
// peindrait avec ceux du premier — ou avec rien, si le premier est masqué.
// Chacun a donc les siens.
let compteur = 0;
const BOUFFEE = (peinture) => `<circle r="30" fill="${peinture}"/><circle cx="-24" cy="8" r="22" fill="${peinture}"/><circle cx="18" cy="10" r="20" fill="${peinture}"/>`;
/**
 * Le logo du Groupe STA en mouvement, en SVG : les roues tournent, la caisse
 * vibre sur ses suspensions, l'échappement fume, l'air file et la route
 * défile. Rend une chaîne à insérer telle quelle (`innerHTML`, `v-html`,
 * `{!! !!}`) ; la feuille de style est injectée au premier appel.
 *
 * ⚠️ Le WebView des Sunmi (Chrome 62) ignore `transform-box` : chaque pièce
 * qui tourne ou grandit est dessinée autour de (0,0), dans un groupe déjà mis
 * en place, et s'anime avec `transform-origin: 0 0`.
 */
export function voiture(options) {
    const { largeur, slogan = true, theme = 'classe', anime = true, classe = '' } = options;
    injecterStyles();
    const id = `sta-v${++compteur}`;
    const peinture = (nom) => `url(#${id}-${nom})`;
    // Hauteur du cadre : jusqu'à la route, ou jusqu'au slogan descendu sous elle.
    const hauteur = slogan ? 470 : 373;
    const classes = ['sta-voiture', `sta-theme-${theme}`, anime ? '' : 'sta-immobile', classe].filter(Boolean).join(' ');
    return (`<svg class="${classes}" viewBox="20 255 1360 ${hauteur}" width="${largeur}" height="${Math.round((largeur * hauteur) / 1360)}" aria-hidden="true" focusable="false">` +
        '<defs>' +
        `<linearGradient id="${id}-caisse" gradientUnits="userSpaceOnUse" x1="760" y1="540" x2="802" y2="275"><stop offset="0" class="sta-caisse-bas"/><stop offset="1" class="sta-caisse-haut"/></linearGradient>` +
        `<linearGradient id="${id}-slogan" gradientUnits="userSpaceOnUse" x1="0" y1="604" x2="0" y2="672"><stop offset="0" class="sta-slogan-haut"/><stop offset="1" class="sta-slogan-bas"/></linearGradient>` +
        // Sur une ligne, un dégradé en `objectBoundingBox` (hauteur nulle) ne peint rien.
        `<linearGradient id="${id}-route" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="1380" y2="0"><stop offset="0" class="sta-route-bord"/><stop offset=".22" class="sta-route-plein"/><stop offset=".85" class="sta-route-plein"/><stop offset="1" class="sta-route-bord"/></linearGradient>` +
        `<radialGradient id="${id}-fumee"><stop offset="0" class="sta-fumee-coeur"/><stop offset=".55" class="sta-fumee-voile"/><stop offset="1" class="sta-fumee-bord"/></radialGradient>` +
        `<radialGradient id="${id}-ombre"><stop offset="0" class="sta-ombre-coeur"/><stop offset="1" class="sta-ombre-bord"/></radialGradient>` +
        '</defs>' +
        // La route défile vers l'arrière, l'ombre suit la caisse.
        `<line class="sta-route" x1="40" y1="608" x2="1380" y2="608" stroke="${peinture('route')}"/>` +
        `<g transform="translate(790 600)"><ellipse class="sta-ombre" rx="560" ry="16" fill="${peinture('ombre')}"/></g>` +
        // L'air qui file derrière la voiture.
        '<g class="sta-sillage">' +
        '<line class="sta-trait sta-trait-1" x1="120" y1="318" x2="185" y2="318"/>' +
        '<line class="sta-trait sta-trait-2" x1="70" y1="392" x2="175" y2="392"/>' +
        '<line class="sta-trait sta-trait-3" x1="105" y1="452" x2="180" y2="452"/>' +
        '</g>' +
        // La fumée part du pot d'échappement, grossit et se dissipe.
        '<g class="sta-sillage" transform="translate(236 528)">' +
        [1, 2, 3, 4].map((n) => `<g class="sta-bouffee sta-bouffee-${n}">${BOUFFEE(peinture('fumee'))}</g>`).join('') +
        '</g>' +
        // Les roues, centrées sur (0,0) pour tourner sur elles-mêmes.
        `<g transform="translate(410.3 498.5)"><path class="sta-roue sta-roue-ar" d="${ROUE_ARRIERE}"/></g>` +
        `<g transform="translate(1169.9 500.7)"><path class="sta-roue sta-roue-av" d="${ROUE_AVANT}"/></g>` +
        // La caisse et le sigle STA.
        `<path class="sta-caisse" fill="${peinture('caisse')}" fill-rule="evenodd" d="${CAISSE}"/>` +
        (slogan ? `<path transform="translate(0 44)" fill="${peinture('slogan')}" fill-rule="evenodd" d="${SLOGAN}"/>` : '') +
        '</svg>');
}
