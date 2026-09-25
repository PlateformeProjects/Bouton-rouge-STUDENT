# Workshop State Sync : Événement vs État (WebSocket / STOMP)

Atelier pratique de 30 minutes démontrant la différence architecturale fondamentale entre **diffuser un flux d'événements** (*Event Stream*) et **diffuser un snapshot d'état consolidé** (*State Snapshot*).

---

## Architecture du projet

```text
workshop-state-sync/
├── backend/    (Spring Boot 3, Java 21, Maven Wrapper)
├── frontend/   (Vite, React 18, TypeScript, Tailwind CSS, @stomp/stompjs)
└── README.md   (Guide pas à pas pour l'atelier)
```

- **Backend** : Spring Boot 3 avec WebSocket STOMP
  - Endpoint WebSocket : `/ws`
  - Broker simple en mémoire : `/topic`
  - Préfixe applicatif routé : `/app`
- **Frontend** : Application React 18 monopage minimaliste avec `@stomp/stompjs`

---

## 1. Lancement rapide

### Prérequis
- Java 21 (JDK 21)
- Node.js (version 18+ ou 20+) et npm

### Terminal 1 : Lancement du Backend (Spring Boot)
```bash
cd backend
./mvnw spring-boot:run
```
Le serveur démarre sur `http://localhost:8080`. Le point d'entrée WebSocket STOMP est accessible sur `ws://localhost:8080/ws`.

### Terminal 2 : Lancement du Frontend (Vite + React)
```bash
cd frontend
npm install
npm run dev
```
L'interface est accessible sur `http://localhost:5173`.

---

## 2. Étape 1 : Le crash-test (10 min)

### Objectif
Observer la défaillance inhérente à la diffusion exclusive d'événements différentiels (*delta events*) sans mécanisme de rattrapage d'état.

### Procédure
1. Ouvrez **deux fenêtres ou onglets de votre navigateur côte à côte** sur `http://localhost:5173`.
2. Vérifiez que les deux onglets affichent le badge vert **Connecté** et un compteur à `0`.
3. Cliquez plusieurs fois sur le bouton `[ +1 ]` depuis le premier onglet.
   - Constat : Les deux onglets s'incrémentent en temps réel (ex: valeur 5).
4. Ouvrez maintenant un **troisième onglet** sur `http://localhost:5173` (ou appuyez sur **F5** sur l'un des onglets).
   - Constat : Le nouvel onglet affiche `0` alors que le serveur et les autres onglets sont à `5`. Si vous cliquez à nouveau sur `[ +1 ]`, le nouvel onglet passe à `1` pendant que les autres passent à `6`.

### Analyse du problème
- Côté Backend : L'action `/app/increment` se contente de diffuser un message `{"type": "INCREMENT"}` sur `/topic/counter-events`.
- Côté Frontend : Le composant s'abonne à `/topic/counter-events` et effectue un incrément local `setCount(prev => prev + 1)` à chaque réception d'événement.
- **Diagnostic** : Le nouveau client écoute un flux temporel d'événements, mais ne reçoit aucun historique ni état initial. Il est désynchronisé de manière irréversible.

---

## 3. Étape 2 : Le challenge - Réparer la synchronisation d'état (15 min)

### Objectif
Faire évoluer l'architecture d'un modèle basé sur les événements (*Event Stream*) vers un modèle piloté par l'**état consolidé** (*State Snapshot*). À l'issue de cette étape, tout nouveau client ou tout client qui rafraîchit sa page doit immédiatement afficher la valeur exacte du compteur sans attendre un nouvel incrément.

---

### A. Travail à réaliser côté Backend (`backend/.../CounterController.java`)

Ouvrez le fichier [CounterController.java](file:///backend/src/main/java/com/workshop/statesync/controller/CounterController.java) :

1. **Diffuser l'état consolidé lors de l'incrément** :
   - Au lieu de renvoyer un simple `CounterEvent("INCREMENT")`, faites en sorte que la méthode `@MessageMapping("/increment")` retourne l'état absolu du compteur (`CounterState`).
   - Adaptez la destination de diffusion (`@SendTo`) pour utiliser le topic dédié à l'état : `/topic/counter-state`.

2. **Délivrer un snapshot immédiat à la connexion d'un client** :
   - Lorsqu'un utilisateur ouvre un nouvel onglet, il s'abonne pour la première fois. Il a besoin de recevoir l'état actuel *uniquement pour lui*, sans polluer les autres clients connectés.
   - **Indice** : Spring Messaging propose une annotation spécifique conçue pour intercepter une souscription et renvoyer une réponse directe et unitaire au souscripteur.
   - Créez une méthode annotée avec `@SubscribeMapping("/counter-state")` qui retourne l'état actuel issu de `counterService.get()`.
   - *Rappel d'architecture* : Consultez [WebSocketConfig.java](file:///backend/src/main/java/com/workshop/statesync/config/WebSocketConfig.java) pour comprendre comment les destinations préfixées par `/app` sont routées vers vos contrôleurs.

---

### B. Travail à réaliser côté Frontend (`frontend/src/App.tsx`)

Ouvrez le fichier [App.tsx](file:///frontend/src/App.tsx) :

1. **Supprimer l'incrément aveugle** :
   - Actuellement, le client fait `setCount(prev => prev + 1)` à chaque message reçu. Supprimez cette logique qui repose sur l'hypothèse (fausse) que le client n'a manqué aucun événement.

2. **Mettre en place la double souscription STOMP** :
   Dans le bloc de connexion `onConnect`, vous devez mettre en place deux souscriptions complémentaires :
   - **Souscription 1 (Snapshot initial)** : S'abonner à la destination applicative (`/app/counter-state`) pour récupérer immédiatement la photo de l'état actuel renvoyée par le serveur à l'arrivée. Mettre à jour `count` avec la valeur reçue (`data.count`).
   - **Souscription 2 (Mises à jour temps réel)** : S'abonner au broker (`/topic/counter-state`) pour écouter les modifications d'état diffusées à l'ensemble des clients lors de chaque incrément, et appliquer la valeur reçue.

3. Redémarrez le backend (`./mvnw spring-boot:run`) pour appliquer les modifications Java (le frontend se recharge automatiquement à chaud via Vite).

---

### C. Critères de validation (Definition of Done)

Vérifiez que votre implémentation valide l'ensemble des cas suivants :

- [ ] **Test 1 - Diffusion collective** : En ayant deux onglets ouverts côte à côte, cliquer sur `[ +1 ]` sur l'un synchronise instantanément la valeur sur les deux onglets.
- [ ] **Test 2 - Connexion tardive (*Late Joiner*)** : Après avoir incrémenté le compteur jusqu'à une valeur arbitraire (ex: `7`), ouvrir un 3e onglet dans une nouvelle fenêtre. Le 3e onglet doit afficher directement `7` dès l'apparition du badge vert "Connecté", sans afficher `0`.
- [ ] **Test 3 - Résilience au rafraîchissement** : Faire **F5** sur l'un des onglets. La valeur doit être immédiatement restituée et les clics ultérieurs doivent continuer à fonctionner de façon synchronisée.

---

## 4. Débriefing (5 min)

### Comparatif conceptuel

| Critère | Flux d'événements (*Event Stream*) | Snapshot d'état (*State Snapshot*) |
| :--- | :--- | :--- |
| **Contenu du message** | "Ce qui vient de se passer" (`{"type": "INCREMENT"}`) | "Ce qui est vrai maintenant" (`{"count": 8}`) |
| **Hypothèse client** | Suppose que le client a tout écouté depuis le début | Autonome et résilient aux arrivées tardives |
| **Arrivée tardive / Reconnexion** | État désynchronisé ou corrompu | Synchronisation immédiate et exacte |
| **Idempotence** | Faible (appliquer deux fois = doublon) | Forte (appliquer plusieurs fois = même état) |

### Parallèle direct avec le projet "Le Buzzer"
Dans une application de type "Buzzer" multijoueur :
- **Si vous diffusez des événements purs** :
  - Événement : *"Joueur 2 a buzzé"*, *"Question 3 lancée"*, *"Temps écoulé"*.
  - Un joueur qui subit une micro-coupure réseau (Wi-Fi qui saute, onglet rafraîchi) ou qui rejoint la partie après le coup d'envoi ignore qui mène la partie, si le buzzer est actuellement verrouillé ou quelle question est active.
- **Avec une gestion par State Snapshot** :
  - À chaque action, le serveur calcule et diffuse l'état consolidé de la manche :
    `{ currentQuestionId: 3, buzzerLocked: true, lockedBy: "Alice", scores: { Alice: 10, Bob: 5 } }`.
  - À la connexion (ou reconnexion), le joueur souscrit à l'état et reçoit instantanément la photo exacte de la partie en cours.
