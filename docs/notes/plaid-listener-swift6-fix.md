# Plaid listener Swift 6 fix

The Plaid connection controller no longer touches Firestore's non-Sendable `ListenerRegistration` from the controller's actor-isolated deinitializer. Listener cleanup is delegated to a small lifetime handle and remains explicitly removable from the main-actor controller when the screen disappears.
