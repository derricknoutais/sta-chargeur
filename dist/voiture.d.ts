/**
 * Le thème des couleurs :
 *  - `classe` (défaut) : sombre quand un ancêtre porte la classe `dark` — la
 *    convention des kits Laravel et de Tailwind (`darkMode: 'class'`) ;
 *  - `systeme` : suit le réglage de l'appareil (`prefers-color-scheme`) ;
 *  - `clair`, `sombre` : imposés.
 */
export type Theme = 'classe' | 'systeme' | 'clair' | 'sombre';
export interface OptionsVoiture {
    /** Largeur en pixels ; la hauteur suit les proportions du logo. */
    largeur: number;
    /** Le slogan « Services Tous Azimuts » sous la voiture. Défaut : oui. */
    slogan?: boolean;
    /** Voir `Theme`. Défaut : `classe`. */
    theme?: Theme;
    /** Faux : la voiture à l'arrêt, sans fumée ni vent — pour un en-tête. Défaut : vrai. */
    anime?: boolean;
    /** Classes ajoutées au `<svg>`. */
    classe?: string;
}
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
export declare function voiture(options: OptionsVoiture): string;
