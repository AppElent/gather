// SPIKE (APP-652, do not merge). The one call the watch handoff needs:
// `updateApplicationContext`, which the system delivers to the watch app
// later, whether or not either app is running.

import ExpoModulesCore
import WatchConnectivity

public class WatchConnectivityModule: Module {
  private let relay = SessionRelay()

  public func definition() -> ModuleDefinition {
    Name("GatherWatchConnectivity")

    OnCreate { self.relay.activate() }

    /// Replaces the context the watch sees. Queued until the session is active.
    AsyncFunction("updateApplicationContext") { (context: [String: String]) in
      try self.relay.update(context)
    }

    Function("getState") { () -> [String: Any] in
      self.relay.state()
    }
  }
}

final class SessionRelay: NSObject, WCSessionDelegate {
  private var pending: [String: String]?

  func activate() {
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func update(_ context: [String: String]) throws {
    guard WCSession.isSupported() else { throw Exception(name: "Unsupported", description: "WatchConnectivity is not supported") }
    let session = WCSession.default
    guard session.activationState == .activated else {
      pending = context
      NSLog("[watch-spike] session not active yet, queued")
      return
    }
    try session.updateApplicationContext(context)
    NSLog("[watch-spike] updateApplicationContext sent (paired=\(session.isPaired), installed=\(session.isWatchAppInstalled))")
  }

  func state() -> [String: Any] {
    guard WCSession.isSupported() else { return ["supported": false] }
    let session = WCSession.default
    return [
      "supported": true,
      "activation": session.activationState.rawValue,
      "paired": session.isPaired,
      "watchAppInstalled": session.isWatchAppInstalled,
    ]
  }

  func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
    NSLog("[watch-spike] activation \(state.rawValue) \(String(describing: error))")
    if state == .activated, let context = pending {
      pending = nil
      try? update(context)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  func sessionDidDeactivate(_ session: WCSession) {
    // The person switched watches: activate again for the new one.
    WCSession.default.activate()
  }
}
