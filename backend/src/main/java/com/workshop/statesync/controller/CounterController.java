package com.workshop.statesync.controller;

import com.workshop.statesync.model.CounterEvent;
import com.workshop.statesync.model.CounterState;
import com.workshop.statesync.service.CounterService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.annotation.SubscribeMapping;
import org.springframework.stereotype.Controller;

@Controller
public class CounterController {

    private final CounterService counterService;

    public CounterController(CounterService counterService) {
        this.counterService = counterService;
    }

    // =========================================================================
    // ÉTAPE 1 : Le piège pédagogique (Diffusion d'événement / Event Stream)
    // =========================================================================
    // Le serveur incrémente son compteur, mais ne diffuse qu'un événement "INCREMENT".
    // Problème : Si un client arrive plus tard ou rafraîchit (F5), il n'a aucun moyen
    // de connaître la valeur courante du compteur sans avoir assisté à tous les événements passés.
    @MessageMapping("/increment")
    @SendTo("/topic/counter-events")
    public CounterEvent increment() {
        counterService.incrementAndGet();
        return new CounterEvent("INCREMENT");
    }

    // =========================================================================
    // ÉTAPE 2 : La réparation (Diffusion d'état / State Snapshot)
    // =========================================================================
    // Consignes pour l'exercice :
    // 1. Modifier ou remplacer increment() pour diffuser un objet d'état consolidé
    //    (CounterState) à tous les clients abonnés, plutôt qu'un simple événement "INCREMENT".
    // 2. Implémenter un point d'accès de souscription (utilisant l'annotation appropriée
    //    de Spring Messaging) permettant à un client qui vient de se connecter
    //    de recevoir immédiatement la valeur courante du compteur sans attendre
    //    un nouvel incrément.
    // =========================================================================
}
