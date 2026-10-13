# sta-chargeur

Le chargeur de la suite STA : la voiture du logo du Groupe STA — « Services Tous
Azimuts » — roues qui tournent, caisse qui vibre, échappement qui fume, route
qui défile. Toute attente se voit, dans toutes les applications, de la même
façon.

Extrait de Storit le 14/10/2026. Dépôt privé `derricknoutais/sta-chargeur`.

## Ce qu'il fait

Deux formes :

- le **voile**, qui couvre l'écran et bloque : changer de page, enregistrer,
  valider, écrire dans Lightspeed ou QuickBooks — tout ce qu'un second clic
  pendant l'attente rendrait ambigu. Une carte blanche, la voiture, une phrase
  (« Écriture dans Lightspeed… ») et, au besoin, une précision (« Ne quittez
  pas cette page. ») ;
- la **pastille**, en haut au centre, qui ne bloque rien : un filtre, une page
  de la même liste, une recherche pendant qu'on tape, une lecture de code.

Rien sous **200 ms** (une navigation instantanée ne clignote pas), puis au
moins **450 ms** à l'écran (pas d'éclair). Les attentes se cumulent : la plus
récente parle ; le voile l'emporte sur la pastille.

Thème sombre (sous `.dark`, ou selon l'appareil), animations coupées pour qui
les a désactivées (`prefers-reduced-motion`), annonce aux lecteurs d'écran.
Écrit pour le WebView **Chrome 62** des terminaux Sunmi : pas de `inset`, de
`gap` en flexbox, de `backdrop-filter`, de `transform-box` ; JavaScript ES2015.

Sans framework : un cœur en JavaScript, et un **branchement** par façon dont
l'application parle au serveur.

| L'application parle par…           | Branchement             |
| ---------------------------------- | ----------------------- |
| Inertia 1, 2 ou 3                  | `brancherInertia`       |
| axios (0.18 à 1.x)                 | `brancherAxios`         |
| Livewire 2                         | `brancherLivewire`      |
| des liens et formulaires (Blade)   | `brancherNavigation`    |
| `fetch`, ou tout autre chose       | `suivre(promesse)`      |

## Installation

```bash
npm install github:derricknoutais/sta-chargeur#v0.1.0
```

Le dépôt est **privé** : `npm` le récupère par git, avec les identifiants de
la machine (trousseau macOS en local ; le serveur Forge de STA lit déjà les
dépôts privés de Derrick). Depuis le Mac de Derrick, GitHub ne répond qu'à
travers le proxy LadderVPN (`127.0.0.1:9090`).

Chaque application **monte de version explicitement** (`#v0.1.1`, …) : rien
ne change chez elle sans qu'elle le décide.

Le verrou (`package-lock.json`) note le paquet en `git+ssh://git@github.com/…` :
un `npm ci` sur un serveur doit pouvoir lire ce dépôt privé (clé SSH du serveur
reconnue par GitHub). Une application qui versionne son `public/build` (PullDB,
Fidbak) n'en a pas besoin au déploiement ; celle qui construit sur le serveur
(Storit) si.

Un projet qui garde aussi un `yarn.lock` : `npm install` le réécrit au passage
(même avec `--no-save`) — vérifier qu'il reste cohérent avec ce que le
déploiement utilise, ou installer avec l'outil du projet.

## Brancher une application

Un seul chargeur par page, partagé par tous les branchements : on peut en
cumuler plusieurs (Inertia + navigation, axios + Livewire + navigation…).
Chaque `brancher…` rend la fonction qui débranche.

### Inertia (Vue 3)

Dans `resources/js/app.ts`, retirer la barre d'Inertia et brancher le routeur :

```ts
import { brancherInertia, brancherNavigation } from '@derricknoutais/sta-chargeur';
import { createInertiaApp, router } from '@inertiajs/vue3';

createInertiaApp({
    // …
    progress: false, // la barre grise d'Inertia : le chargeur la remplace
});

brancherInertia(router, {
    // Facultatif : une phrase pour les gestes longs ou importants.
    decrire: (visite) => {
        if (visite.methode === 'post' && /^\/revue\/\d+\/valider$/.test(visite.chemin)) {
            return { message: 'Écriture dans Lightspeed…', detail: 'Ne quittez pas cette page.' };
        }
        return null; // « Chargement… » par défaut
    },
});

// Les liens <a href> ordinaires (connexion par le compte STA, pages hors Inertia).
brancherNavigation();
```

Par défaut : un GET vers la page affichée (filtre, tri, pagination) →
pastille ; toute autre visite → voile ; préchargements (`prefetch`) et
visites `async` / `showProgress: false` (polling, `router.reload` en fond) →
rien. Pour un polling d'Inertia 1, qui ne connaît pas `showProgress` :

```ts
brancherInertia(router, {
    classer: (visite, parDefaut) => (visite.chemin === '/etat-sync' ? null : parDefaut),
});
```

`visite` : `{ methode, chemin, url, brute }` — `brute` est la visite propre à
la version d'Inertia.

### Vue 2 + Blade (Laravel Mix) — ou Vue 3 + Vite sans Inertia

Valable pour toute application à pages Blade qui parle par axios, quels que
soient Vue et l'outil de build (Fidbak v2 : Vue 3 + Vite 8, axios 1.7).

Dans `resources/js/bootstrap.js`, après la création de `window.axios` :

```js
import { brancherAxios, brancherNavigation } from '@derricknoutais/sta-chargeur';

brancherAxios(window.axios);
brancherNavigation();
```

⚠️ Brancher **avant** tout intercepteur de réponse qui peut ne jamais rendre
la main — un gardien de session qui, sur un 401/419, redirige et rend une
promesse sans fin : les intercepteurs de réponse s'exécutent dans l'ordre où
on les pose, et posé après lui, le chargeur ne verrait jamais la fin de la
requête (voile coincé).

Par défaut, une requête GET → pastille « Chargement… » ; POST, PUT, PATCH →
voile « Enregistrement… » ; DELETE → voile « Suppression… ». Les visites
Inertia (en-tête `X-Inertia`) sont ignorées : c'est le travail de
`brancherInertia`. Une requête précise se règle dans sa configuration :

```js
axios.get('/notifications', { staChargeur: false }); // un polling : rien
axios.post('/qbo/ecritures', data, { staChargeur: { message: 'Écriture dans QuickBooks…' } });
axios.get('/stock', { staChargeur: { mode: 'voile' } });
```

Ou pour toute l'application : `brancherAxios(axios, { classer, decrire })`,
même principe qu'Inertia (`classer(requete, parDefaut)` rend `'voile'`,
`'pastille'` ou `null`).

`brancherNavigation()` montre le voile quand on **quitte la page** par un lien
ou un formulaire classique, le temps que la suivante arrive. Il ignore d'office
ce que l'application a déjà intercepté (`preventDefault` : `@click.prevent`,
`@submit.prevent`, `wire:submit.prevent`, les `<Link>` d'Inertia), les nouveaux
onglets (`target="_blank"`, Ctrl/Cmd-clic), les ancres, les autres sites, les
fichiers (`.pdf`, `.xlsx`, `.csv`…) et les liens `download`. Les méthodes
simulées par Laravel (`@method('DELETE')`) sont reconnues.

### Livewire 2

```js
import { brancherAxios, brancherLivewire, brancherNavigation } from '@derricknoutais/sta-chargeur';

document.addEventListener('livewire:load', () => brancherLivewire(window.Livewire));
brancherNavigation();
brancherAxios(window.axios); // si l'application fait aussi des appels axios
```

Une méthode de l'application (`wire:click="enregistrer"`, `wire:submit`) →
voile ; un champ (`wire:model`), un événement, `$refresh`, `$set`, `$toggle`
ou la pagination → pastille ; un envoi de fichier → pastille « Envoi du
fichier… » ; une redirection (`$this->redirect()`) garde le voile jusqu'au
départ. Un `wire:poll` qui appelle une méthode se fait taire par `classer` :

```js
brancherLivewire(window.Livewire, {
    classer: (echange, parDefaut) => (echange.appels.includes('rafraichir') ? null : parDefaut),
});
```

`echange` : `{ composant, appels, champs, evenements }`. Livewire 3 n'est pas
encore pris en charge (son API de crochets a changé) : il est signalé dans la
console et laissé tranquille.

### fetch, et le reste

Ce qu'aucun branchement ne voit passer se signale à la main :

```ts
import { suivre, chargeur } from '@derricknoutais/sta-chargeur';

const r = await suivre(fetch(`/recherche?q=${q}`), 'Recherche…'); // pastille
await suivre(televerser(fichier), 'Envoi de la photo…', 'voile'); // voile

// Une attente qui n'est pas une promesse :
const fin = chargeur().attendre('voile', { message: 'Impression…', detail: 'Le ticket sort.' });
// …
fin();
```

`suivre` rend la promesse telle quelle (résultat ou erreur).

## Écarter quelque chose

| Quoi                                    | Comment                                                        |
| --------------------------------------- | -------------------------------------------------------------- |
| un lien ou formulaire qui télécharge    | `download` sur le lien, ou `data-sta-chargeur="non"`           |
| toute une zone de la page               | `data-sta-chargeur="non"` sur un ancêtre                       |
| une requête axios (polling, ping)       | `{ staChargeur: false }` dans sa configuration                 |
| une visite Inertia de fond              | `async: true` ou `showProgress: false`, sinon `classer` → `null` |
| une requête Livewire de fond            | `classer` → `null`                                             |

Un lien qui télécharge sans le dire (une route `/export` qui renvoie un
fichier) ne quitte pas la page : le voile se retire de lui-même au bout de
15 s (`brancherNavigation({ securite })`), mais mieux vaut le marquer.

## Réglages

```ts
import { chargeur } from '@derricknoutais/sta-chargeur';

chargeur({
    theme: 'classe', // 'classe' (sombre sous .dark) | 'systeme' | 'clair' | 'sombre'
    delai: 200, // ms avant d'afficher
    minimum: 450, // ms à l'écran, au moins
    messages: { voile: 'Chargement…', pastille: 'Mise à jour…' },
});
```

Les couleurs de la carte et de la pastille se branchent sur celles de
l'application par des variables CSS (le logo, lui, garde les siennes) :

```css
:root {
    --sta-chargeur-fond: hsl(var(--card));
    --sta-chargeur-texte: hsl(var(--foreground));
    --sta-chargeur-discret: hsl(var(--muted-foreground));
    --sta-chargeur-ecran: rgba(13, 28, 33, 0.42); /* derrière la carte */
    --sta-chargeur-z: 99999; /* le plan, au-dessus des modales */
}
```

Une application qui agrandit son conteneur par `zoom` (PullDB : `zoom: 1.25`
sur sa mise en page) : le chargeur, ajouté à la fin de `<body>`, reste hors de
ce conteneur — lui donner la même échelle, `.sta-chargeur { zoom: 1.25; }`.

La feuille de style est injectée dans `<head>` au premier affichage. Sous une
CSP stricte, l'inclure soi-même : elle est exportée (`FEUILLE`).

Le logo seul, pour un en-tête ou une page de connexion :

```ts
import { voiture } from '@derricknoutais/sta-chargeur';

el.innerHTML = voiture({ largeur: 160, anime: false }); // à l'arrêt
el.innerHTML = voiture({ largeur: 64, slogan: false }); // en mouvement, sans slogan
```

## Intégrer dans une application : où regarder

Brancher ne suffit pas : il faut **regarder partout** où l'application fait
attendre, et vérifier que chaque attente se voit, une seule fois.

1. **Le point d'entrée** (`app.ts`, `app.js`, `bootstrap.js`) : les
   branchements qui correspondent à la pile (tableau plus haut), et
   `progress: false` pour Inertia.
2. **Les chargeurs existants** : barre NProgress, spinner plein écran maison,
   overlay de chargement global → les retirer, ils feraient double emploi.
   Garder les petits indicateurs **locaux** (bouton désactivé avec une
   icône qui tourne, `wire:loading` sur un bouton) : ils disent quel bouton
   travaille, le chargeur dit que l'application travaille.
3. **Les appels `fetch`** → `suivre(…)`. Les appels axios sont couverts par
   `brancherAxios` ; vérifier qu'aucune instance axios **séparée**
   (`axios.create(…)`) n'y échappe — la brancher aussi.
4. **Le polling et les rafraîchissements de fond** (`setInterval`,
   `wire:poll`, `router.reload` périodique, `usePoll`) → les écarter : un
   chargeur toutes les cinq secondes est pire que rien.
5. **Les exports et téléchargements** (`/export`, PDF, Excel, CSV) →
   `download` ou `data-sta-chargeur="non"`.
6. **Les gestes longs ou qui écrivent ailleurs** (Lightspeed via PullDB,
   QuickBooks via qbo-pass, synchronisations, imports, lancements de jobs) →
   un message qui dit ce qui se passe (`decrire`, `staChargeur.message`), et
   `detail` quand il ne faut pas quitter la page.
7. **Les modales et le plan** : le voile doit passer au-dessus de tout
   (`--sta-chargeur-z` si une modale monte plus haut que 99999).
8. **Le thème** : `.dark` sur `<html>` → rien à faire ; thème selon l'appareil
   (`@media (prefers-color-scheme)`) → `chargeur({ theme: 'systeme' })` ;
   pas de thème sombre → `chargeur({ theme: 'clair' })`.
9. **Les terminaux Sunmi** : si l'application y tourne, `sunmi-verifier` (du
   paquet sunmi-scan) après le build.
10. **Vérifier** : build, tests de l'application, puis à la main un geste lent
    (voile), un filtre (pastille), un export (rien), un retour arrière (rien
    de coincé).

## Démo

```bash
npm run demo
```

Puis <http://localhost:8766/demo/> : boutons à essayer, et des adresses qui
rejouent des scénarios minutés (`?s=lent`, `?s=court`, `?s=rapide`,
`?s=interrompu`, `?s=transition`), figent l'affichage (`?fixe=voile`,
`?fixe=pastille`) ou passent en sombre (`&sombre`, `&theme=systeme`).

## Faire évoluer le paquet

`dist/` est versionné, comme dans sunmi-scan :

```bash
npm test             # compile puis lance les tests (node --test)
git add src dist test && git commit
git tag v0.1.1 && git push origin main --tags
```

Puis chaque application monte de version (`npm install github:derricknoutais/sta-chargeur#v0.1.1`).

Les contours du logo (`src/traces.ts`) sont des données tracées d'après
l'image officielle : ne pas les retoucher à la main.
