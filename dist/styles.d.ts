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
/** Toute la feuille, pour qui préfère l'inclure lui-même (CSP stricte, par exemple). */
export declare const FEUILLE: string;
/** Injecte la feuille une fois par page. Sans effet hors navigateur (rendu serveur). */
export declare function injecterStyles(): void;
