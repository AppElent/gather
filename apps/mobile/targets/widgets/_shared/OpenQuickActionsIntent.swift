import AppIntents
import Foundation

/// Opens Gather on the quick-actions sheet (APP-207).
///
/// `openAppWhenRun` launches or foregrounds the app and runs `perform()` in the
/// app's own process, which leaves a request in the app's user defaults for
/// `src/shell/controlRequest.ts` to take: on its first render after a cold
/// start, or through the defaults' change notice when the app was running.
///
/// Not `OpenURLIntent(<scheme>://quick)`: iOS opens only universal links from an
/// App Intent and drops a custom scheme's URL, so the app opened without the
/// sheet. The defaults also outlive the bundle loading, where a link arriving
/// on a cold start would find nothing listening yet.
///
/// In `_shared`, which `@bacons/apple-targets` compiles into the app as well as
/// the widget extension: an intent that opens the app must exist in the app
/// for the system to run it there.
@available(iOS 18.0, *)
struct OpenQuickActionsIntent: AppIntent {
  static let title: LocalizedStringResource = "Quick actions"
  /// Only the control runs it; it is not offered in Shortcuts or Spotlight.
  static let isDiscoverable = false
  static let openAppWhenRun = true

  /// Must match `CONTROL_REQUEST_KEY` in `src/shell/controlRequest.ts`.
  static let requestKey = "GatherQuickActionsControlRequestedAt"

  @MainActor
  func perform() async throws -> some IntentResult {
    // When it was asked, in milliseconds like JavaScript's `Date.now()`, so a
    // request the app never took does not open the sheet on a later launch.
    UserDefaults.standard.set(
      Date().timeIntervalSince1970 * 1000, forKey: Self.requestKey)
    return .result()
  }
}

/// What the control needs to know about the variant it belongs to (ADR 0045),
/// read from the bundle rather than written here, so one source serves the
/// production, preview and development builds.
enum GatherApp {
  /// The app's display name. The extension's own is set to the app's by its
  /// `expo-target.config.js`, so either bundle answers the same.
  static var name: String {
    Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
      ?? "Gather"
  }

  /// "Preview" or "Dev" on those builds, from the name `app.config.ts` gives
  /// them ("Gather Preview", "Gather Dev"); nil on the production build.
  static var variant: String? {
    let prefix = "Gather "
    guard name.hasPrefix(prefix) else { return nil }
    let variant = name.dropFirst(prefix.count)
    return variant.isEmpty ? nil : String(variant)
  }
}
