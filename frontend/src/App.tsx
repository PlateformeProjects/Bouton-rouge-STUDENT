import { useEffect, useRef, useState } from 'react';
import { Client, IMessage } from '@stomp/stompjs';

export default function App() {
  const [count, setCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    const client = new Client({
      brokerURL: 'ws://localhost:8080/ws',
      reconnectDelay: 3000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        setIsConnected(true);

        // =====================================================================
        // ÉTAPE 1 : Le piège pédagogique (Diffusion d'événement / Event Stream)
        // =====================================================================
        // On s'abonne à un flux d'événements et on incrémente l'état local (+1).
        // Piège : Le client qui se connecte en retard ou fait F5 démarre à 0
        // et n'a aucune connaissance de l'état réel côté serveur !
        client.subscribe('/topic/counter-events', (message: IMessage) => {
          console.log('[STOMP] Événement reçu :', message.body);
          setCount((prev) => prev + 1);
        });

        // =====================================================================
        // ÉTAPE 2 : La réparation (Diffusion d'état / State Snapshot)
        // =====================================================================
        // Consignes pour l'exercice :
        // 1. Adapter la souscription pour recevoir l'état consolidé diffusé par
        //    le serveur à chaque incrément, et assigner setCount avec la valeur reçue.
        // 2. Ajouter une souscription vers le point d'accès applicatif du serveur
        //    pour recevoir le snapshot d'état initial immédiatement à la connexion.
        // =====================================================================
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onStompError: (frame) => {
        console.error('[STOMP] Erreur protocole :', frame.headers['message'], frame.body);
      },
      onWebSocketClose: () => {
        setIsConnected(false);
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, []);

  const handleIncrement = () => {
    if (clientRef.current && isConnected) {
      clientRef.current.publish({
        destination: '/app/increment',
      });
    }
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
        
        {/* En-tête avec badge de connexion */}
        <div className="w-full flex items-center justify-between pb-6 border-b border-slate-800/80 mb-8">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-medium">
            Atelier STOMP
          </span>

          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${
              isConnected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            {isConnected ? 'Connecté' : 'Déconnecté'}
          </div>
        </div>

        {/* Titre */}
        <h2 className="text-xl font-semibold text-slate-300 mb-2">
          Le Compteur Partagé
        </h2>
        <p className="text-xs text-slate-500 mb-8">
          Synchronisation d'état via WebSocket &amp; STOMP
        </p>

        {/* Valeur du compteur */}
        <div className="my-4 py-8 px-12 bg-slate-950/60 border border-slate-800/60 rounded-xl w-full flex items-center justify-center">
          <h1 className="text-6xl font-bold font-mono text-white tracking-tight">
            {count}
          </h1>
        </div>

        {/* Bouton d'action */}
        <button
          onClick={handleIncrement}
          disabled={!isConnected}
          className={`mt-8 w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 flex items-center justify-center gap-3 shadow-lg ${
            isConnected
              ? 'bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white shadow-indigo-600/25 cursor-pointer'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
          }`}
        >
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          [ +1 ]
        </button>

        {/* Pied de carte d'information */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 w-full text-left">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <svg
              className="w-4 h-4 text-indigo-400 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span>Destination d'action : <code className="text-slate-200">/app/increment</code></span>
          </div>
        </div>

      </div>
    </main>
  );
}
