/**
 * Le chargeur de la suite STA : la voiture du logo, roues qui tournent, pour
 * toute attente — un voile qui bloque (changer de page, enregistrer, écrire
 * dans Lightspeed), une pastille qui ne bloque rien (filtre, recherche).
 *
 * Un cœur sans framework et un branchement par façon de parler au serveur :
 * Inertia, axios, Livewire 2, pages classiques. Voir README.md.
 */
export { chargeur, creerChargeur, renduDom, suivre, toucheBloquee } from './chargeur.js';
export { voiture } from './voiture.js';
export { FEUILLE, injecterStyles } from './styles.js';
export { brancherInertia } from './inertia.js';
export { brancherAxios } from './axios.js';
export { attenteDeclaree, brancherNavigation, departParFormulaire, departParLien, REFUS } from './navigation.js';
export { attendreDepart } from './depart.js';
export { brancherLivewire } from './livewire.js';
