import { chargeur, type Attente, type Mode } from './chargeur.js';

/** Une requête Livewire, résumée : ce qu'elle appelle, ce qu'elle synchronise. */
export interface EchangeLivewire {
    /** Le nom du composant (`clients.liste`). */
    composant: string;
    /** Les méthodes appelées (`enregistrer`, `$refresh`, `nextPage`). */
    appels: string[];
    /** Les champs synchronisés (`wire:model`). */
    champs: string[];
    /** Les événements émis (`$emit`). */
    evenements: string[];
}

export interface OptionsLivewire {
    /**
     * Le mode d'une requête, ou `null` pour ne rien montrer. `parDefaut` : une
     * méthode de l'application → `voile` ; un champ, un événement, `$refresh`,
     * `$set`, `$toggle` ou la pagination → `pastille`.
     */
    classer?: (echange: EchangeLivewire, parDefaut: Mode | null) => Mode | null;
    /** Le message d'une requête ; `null` ou rien → celui par défaut. */
    decrire?: (echange: EchangeLivewire, mode: Mode) => Attente | null | undefined;
    /** Durée maximale d'une redirection qui ne quitte pas la page (téléchargement). Défaut : 15 000 ms. */
    securite?: number;
}

// Ce qu'on lit d'un message de Livewire 2.
interface ActionLivewire {
    type?: string;
    payload?: { method?: string; name?: string; event?: string };
}
interface MessageLivewire {
    updateQueue?: ActionLivewire[];
    component?: { name?: string };
    response?: { effects?: { redirect?: string } };
}
/** L'objet `Livewire` global (`window.Livewire`). */
export interface Livewire {
    hook(nom: string, rappel: (...args: any[]) => void): unknown;
    navigate?: unknown;
}

// Des méthodes de Livewire qui rafraîchissent sans rien changer en base.
const LEGERES = ['$refresh', '$set', '$toggle', '$sync', 'gotoPage', 'nextPage', 'previousPage', 'setPage', 'resetPage'];

function resumer(message: MessageLivewire, composant: { name?: string } | undefined): EchangeLivewire {
    const echange: EchangeLivewire = { composant: (composant && composant.name) || (message.component && message.component.name) || '', appels: [], champs: [], evenements: [] };
    for (const action of message.updateQueue || []) {
        const p = action.payload || {};
        if (action.type === 'callMethod' && p.method) echange.appels.push(p.method);
        else if (action.type === 'syncInput' && p.name) echange.champs.push(p.name);
        else if (action.type === 'fireEvent' && p.event) echange.evenements.push(p.event);
    }
    return echange;
}

function classerParDefaut(echange: EchangeLivewire): Mode {
    return echange.appels.some((m) => LEGERES.indexOf(m) < 0) ? 'voile' : 'pastille';
}

/**
 * Montre le chargeur pendant les requêtes Livewire 2 (`wire:click`,
 * `wire:submit`, `wire:model`) et les envois de fichiers. À appeler après le
 * chargement de Livewire :
 *
 *     document.addEventListener('livewire:load', () => brancherLivewire(window.Livewire));
 *
 * Livewire 3 n'est pas encore pris en charge : son API de crochets a changé.
 */
export function brancherLivewire(livewire: Livewire, options: OptionsLivewire = {}): () => void {
    if (!livewire || typeof livewire.hook !== 'function') return () => {};
    if (typeof livewire.navigate === 'function') {
        // eslint-disable-next-line no-console
        console.warn('[sta-chargeur] Livewire 3 détecté : brancherLivewire ne gère que Livewire 2.');
        return () => {};
    }

    const { securite = 15000 } = options;
    const fins = new WeakMap<object, () => void>();
    let actif = true;

    const terminer = (message: object) => {
        const fin = fins.get(message);
        if (!fin) return;
        fins.delete(message);
        fin();
    };

    livewire.hook('message.sent', (message: MessageLivewire, composant?: { name?: string }) => {
        if (!actif) return;
        const echange = resumer(message, composant);
        const parDefaut = classerParDefaut(echange);
        const mode = options.classer ? options.classer(echange, parDefaut) : parDefaut;
        if (!mode) return;
        fins.set(message, chargeur().attendre(mode, (options.decrire && options.decrire(echange, mode)) || {}));
    });

    livewire.hook('message.failed', (message: MessageLivewire) => terminer(message));

    livewire.hook('message.received', (message: MessageLivewire) => {
        const redirection = message.response && message.response.effects && message.response.effects.redirect;
        if (!redirection) return;
        // `$this->redirect()` : Livewire quitte la page sans passer par
        // `message.processed`. Le voile reste jusqu'au départ — ou jusqu'au
        // délai de sécurité, si l'adresse télécharge un fichier.
        const fin = fins.get(message);
        fins.delete(message);
        const depart = chargeur().attendre('voile', { message: 'Chargement…' });
        if (fin) fin();
        setTimeout(depart, securite);
    });

    livewire.hook('message.processed', (message: MessageLivewire) => terminer(message));

    // Les envois de fichiers (`wire:model` sur un champ fichier) : des
    // événements du navigateur, émis sur le champ.
    const envois = new WeakMap<object, () => void>();
    const debutEnvoi = (e: Event) => {
        if (!actif || !e.target) return;
        envois.set(e.target, chargeur().attendre('pastille', { message: 'Envoi du fichier…' }));
    };
    const finEnvoi = (e: Event) => {
        const fin = e.target ? envois.get(e.target) : undefined;
        if (!fin || !e.target) return;
        envois.delete(e.target);
        fin();
    };
    document.addEventListener('livewire-upload-start', debutEnvoi);
    document.addEventListener('livewire-upload-finish', finEnvoi);
    document.addEventListener('livewire-upload-error', finEnvoi);

    // Livewire 2 ne sait pas retirer un crochet : on le rend muet.
    return () => {
        actif = false;
        document.removeEventListener('livewire-upload-start', debutEnvoi);
        document.removeEventListener('livewire-upload-finish', finEnvoi);
        document.removeEventListener('livewire-upload-error', finEnvoi);
    };
}
