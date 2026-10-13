import { chargeur, type Attente, type Mode } from './chargeur.js';

/**
 * Le réglage d'une requête, dans sa configuration axios :
 *
 *     axios.get('/notifications', { staChargeur: false });               // rien
 *     axios.post('/export', data, { staChargeur: { message: 'Export…' } });
 *     axios.get('/stock', { staChargeur: { mode: 'voile' } });
 */
export type ReglageRequete = false | { mode?: Mode | null; message?: string; detail?: string | null };

/** Ce qu'on lit de la configuration d'une requête axios. */
export interface RequeteAxios {
    method?: string;
    url?: string;
    headers?: unknown;
    staChargeur?: ReglageRequete;
}

export interface OptionsAxios {
    /**
     * Le mode d'une requête, ou `null` pour ne rien montrer. `parDefaut` :
     * GET et HEAD → `pastille` ; le reste (on écrit) → `voile`.
     */
    classer?: (requete: RequeteAxios, parDefaut: Mode | null) => Mode | null;
    /** Le message d'une requête ; `null` ou rien → celui par défaut. */
    decrire?: (requete: RequeteAxios, mode: Mode) => Attente | null | undefined;
}

interface Intercepteurs {
    use(succes: (valeur: any) => any, echec?: (erreur: any) => any): number;
    eject(id: number): void;
}

/** Une instance axios, de la 0.18 à la 1.x. */
export interface InstanceAxios {
    interceptors: { request: Intercepteurs; response: Intercepteurs };
}

// Posée sur la configuration elle-même, et non dans une WeakMap : un autre
// intercepteur qui rend une copie (`{ ...config }`) la garde.
const FIN = '__staChargeurFin';

const MESSAGES: Record<string, string> = {
    get: 'Chargement…',
    head: 'Chargement…',
    delete: 'Suppression…',
};

function entete(entetes: unknown, nom: string): unknown {
    if (!entetes || typeof entetes !== 'object') return undefined;
    // axios 1.x : une instance d'AxiosHeaders.
    const avecGet = entetes as { get?: (n: string) => unknown };
    if (typeof avecGet.get === 'function') return avecGet.get(nom);
    // axios 0.x : un objet simple, casse libre.
    const cible = nom.toLowerCase();
    for (const cle of Object.keys(entetes)) {
        if (cle.toLowerCase() === cible) return (entetes as Record<string, unknown>)[cle];
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
export function brancherAxios(axios: InstanceAxios, options: OptionsAxios = {}): () => void {
    const requete = axios.interceptors.request.use((config: RequeteAxios & Record<string, unknown>) => {
        if (!config || config.staChargeur === false || entete(config.headers, 'X-Inertia')) return config;

        const reglage: Exclude<ReglageRequete, false> = config.staChargeur || {};
        const methode = String(config.method || 'get').toLowerCase();
        const parDefaut: Mode | null = methode === 'get' || methode === 'head' ? 'pastille' : 'voile';
        let mode: Mode | null = options.classer ? options.classer(config, parDefaut) : parDefaut;
        if (reglage.mode !== undefined) mode = reglage.mode;
        if (!mode) return config;

        const decrit: Attente = (options.decrire && options.decrire(config, mode)) || {};
        const fin = chargeur().attendre(mode, {
            message: reglage.message || decrit.message || MESSAGES[methode] || 'Enregistrement…',
            detail: reglage.detail !== undefined ? reglage.detail : decrit.detail,
        });
        config[FIN] = fin;

        // Une requête annulée rejette, avec axios 0.x, un `Cancel` qui n'a pas
        // de `.config` : l'intercepteur de réponse ne saurait pas quoi fermer.
        // On écoute donc l'annulation elle-même — jeton (`CancelToken`) ou
        // signal (`AbortController`).
        const jeton = config.cancelToken as { promise?: Promise<unknown> } | undefined;
        if (jeton && jeton.promise && typeof jeton.promise.then === 'function') jeton.promise.then(fin, fin);
        const signal = config.signal as { aborted?: boolean; addEventListener?: (type: string, rappel: () => void) => void } | undefined;
        if (signal && typeof signal.addEventListener === 'function') {
            if (signal.aborted) Promise.resolve().then(fin);
            else signal.addEventListener('abort', fin);
        }
        return config;
    });

    const terminer = (config: Record<string, unknown> | undefined) => {
        const fin = config && config[FIN];
        if (typeof fin === 'function') fin();
    };

    const reponse = axios.interceptors.response.use(
        (rep: { config?: Record<string, unknown> }) => {
            terminer(rep && rep.config);
            return rep;
        },
        (erreur: { config?: Record<string, unknown> }) => {
            terminer(erreur && erreur.config);
            return Promise.reject(erreur);
        },
    );

    return () => {
        axios.interceptors.request.eject(requete);
        axios.interceptors.response.eject(reponse);
    };
}
