import { chargeur } from './chargeur.js';
// Posée sur la configuration elle-même, et non dans une WeakMap : un autre
// intercepteur qui rend une copie (`{ ...config }`) la garde.
const FIN = '__staChargeurFin';
const MESSAGES = {
    get: 'Chargement…',
    head: 'Chargement…',
    delete: 'Suppression…',
};
function entete(entetes, nom) {
    if (!entetes || typeof entetes !== 'object')
        return undefined;
    // axios 1.x : une instance d'AxiosHeaders.
    const avecGet = entetes;
    if (typeof avecGet.get === 'function')
        return avecGet.get(nom);
    // axios 0.x : un objet simple, casse libre.
    const cible = nom.toLowerCase();
    for (const cle of Object.keys(entetes)) {
        if (cle.toLowerCase() === cible)
            return entetes[cle];
    }
    return undefined;
}
/**
 * Montre le chargeur pendant les requêtes d'une instance axios (0.18 à 1.x).
 * Les visites Inertia, qui passent aussi par axios jusqu'à la version 2, sont
 * laissées à `brancherInertia` (en-tête `X-Inertia`).
 *
 *     brancherAxios(window.axios);
 *
 * Rend la fonction qui débranche.
 */
export function brancherAxios(axios, options = {}) {
    const requete = axios.interceptors.request.use((config) => {
        if (!config || config.staChargeur === false || entete(config.headers, 'X-Inertia'))
            return config;
        const reglage = config.staChargeur || {};
        const methode = String(config.method || 'get').toLowerCase();
        const parDefaut = methode === 'get' || methode === 'head' ? 'pastille' : 'voile';
        let mode = options.classer ? options.classer(config, parDefaut) : parDefaut;
        if (reglage.mode !== undefined)
            mode = reglage.mode;
        if (!mode)
            return config;
        const decrit = (options.decrire && options.decrire(config, mode)) || {};
        const fin = chargeur().attendre(mode, {
            message: reglage.message || decrit.message || MESSAGES[methode] || 'Enregistrement…',
            detail: reglage.detail !== undefined ? reglage.detail : decrit.detail,
        });
        config[FIN] = fin;
        // Une requête annulée rejette, avec axios 0.x, un `Cancel` qui n'a pas
        // de `.config` : l'intercepteur de réponse ne saurait pas quoi fermer.
        // On écoute donc l'annulation elle-même — jeton (`CancelToken`) ou
        // signal (`AbortController`).
        const jeton = config.cancelToken;
        if (jeton && jeton.promise && typeof jeton.promise.then === 'function')
            jeton.promise.then(fin, fin);
        const signal = config.signal;
        if (signal && typeof signal.addEventListener === 'function') {
            if (signal.aborted)
                Promise.resolve().then(fin);
            else
                signal.addEventListener('abort', fin);
        }
        return config;
    });
    const terminer = (config) => {
        const fin = config && config[FIN];
        if (typeof fin === 'function')
            fin();
    };
    const reponse = axios.interceptors.response.use((rep) => {
        terminer(rep && rep.config);
        return rep;
    }, (erreur) => {
        terminer(erreur && erreur.config);
        return Promise.reject(erreur);
    });
    return () => {
        axios.interceptors.request.eject(requete);
        axios.interceptors.response.eject(reponse);
    };
}
