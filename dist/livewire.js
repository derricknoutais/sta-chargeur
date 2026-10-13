import { chargeur } from './chargeur.js';
// Des méthodes de Livewire qui rafraîchissent sans rien changer en base.
const LEGERES = ['$refresh', '$set', '$toggle', '$sync', 'gotoPage', 'nextPage', 'previousPage', 'setPage', 'resetPage'];
function resumer(message, composant) {
    const echange = { composant: (composant && composant.name) || (message.component && message.component.name) || '', appels: [], champs: [], evenements: [] };
    for (const action of message.updateQueue || []) {
        const p = action.payload || {};
        if (action.type === 'callMethod' && p.method)
            echange.appels.push(p.method);
        else if (action.type === 'syncInput' && p.name)
            echange.champs.push(p.name);
        else if (action.type === 'fireEvent' && p.event)
            echange.evenements.push(p.event);
    }
    return echange;
}
function classerParDefaut(echange) {
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
export function brancherLivewire(livewire, options = {}) {
    if (!livewire || typeof livewire.hook !== 'function')
        return () => { };
    if (typeof livewire.navigate === 'function') {
        // eslint-disable-next-line no-console
        console.warn('[sta-chargeur] Livewire 3 détecté : brancherLivewire ne gère que Livewire 2.');
        return () => { };
    }
    const { securite = 15000 } = options;
    const fins = new WeakMap();
    let actif = true;
    const terminer = (message) => {
        const fin = fins.get(message);
        if (!fin)
            return;
        fins.delete(message);
        fin();
    };
    livewire.hook('message.sent', (message, composant) => {
        if (!actif)
            return;
        const echange = resumer(message, composant);
        const parDefaut = classerParDefaut(echange);
        const mode = options.classer ? options.classer(echange, parDefaut) : parDefaut;
        if (!mode)
            return;
        fins.set(message, chargeur().attendre(mode, (options.decrire && options.decrire(echange, mode)) || {}));
    });
    livewire.hook('message.failed', (message) => terminer(message));
    livewire.hook('message.received', (message) => {
        const redirection = message.response && message.response.effects && message.response.effects.redirect;
        if (!redirection)
            return;
        // `$this->redirect()` : Livewire quitte la page sans passer par
        // `message.processed`. Le voile reste jusqu'au départ — ou jusqu'au
        // délai de sécurité, si l'adresse télécharge un fichier.
        const fin = fins.get(message);
        fins.delete(message);
        const depart = chargeur().attendre('voile', { message: 'Chargement…' });
        if (fin)
            fin();
        setTimeout(depart, securite);
    });
    livewire.hook('message.processed', (message) => terminer(message));
    // Les envois de fichiers (`wire:model` sur un champ fichier) : des
    // événements du navigateur, émis sur le champ.
    const envois = new WeakMap();
    const debutEnvoi = (e) => {
        if (!actif || !e.target)
            return;
        envois.set(e.target, chargeur().attendre('pastille', { message: 'Envoi du fichier…' }));
    };
    const finEnvoi = (e) => {
        const fin = e.target ? envois.get(e.target) : undefined;
        if (!fin || !e.target)
            return;
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
