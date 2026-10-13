import { type Attente, type Mode } from './chargeur.js';
/**
 * Le réglage d'une requête, dans sa configuration axios :
 *
 *     axios.get('/notifications', { staChargeur: false });               // rien
 *     axios.post('/export', data, { staChargeur: { message: 'Export…' } });
 *     axios.get('/stock', { staChargeur: { mode: 'voile' } });
 */
export type ReglageRequete = false | {
    mode?: Mode | null;
    message?: string;
    detail?: string | null;
};
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
    interceptors: {
        request: Intercepteurs;
        response: Intercepteurs;
    };
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
export declare function brancherAxios(axios: InstanceAxios, options?: OptionsAxios): () => void;
export {};
