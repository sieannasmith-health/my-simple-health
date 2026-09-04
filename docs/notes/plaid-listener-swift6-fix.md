# Plaid listener Swift 6 fix

The Plaid connection controller keeps Firestore's non-Sendable `ListenerRegistration` isolated to the `@MainActor` controller. The screen owns the listener lifecycle explicitly: `onAppear` calls `start()` and `onDisappear` calls `stop()`, which removes and clears the registration.

There is intentionally no `deinit` cleanup for `ListenerRegistration`. This avoids accessing the non-Sendable Firebase listener from a nonisolated Swift 6 deinitializer while preserving deterministic cleanup through the SwiftUI screen lifecycle.
