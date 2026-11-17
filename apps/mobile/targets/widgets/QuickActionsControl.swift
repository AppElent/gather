import AppIntents
import SwiftUI
import WidgetKit

/// A Control Center, Lock Screen and Action Button control (iOS 18) that opens
/// Gather on the quick-actions sheet: `<scheme>://quick`, through
/// `OpenQuickActionsIntent`.
///
/// It is named after the app ("Gather", "Gather Preview", "Gather Dev"), so
/// the controls of side-by-side variants (ADR 0045) can be told apart in the
/// gallery; the button itself says what it does.
struct QuickActionsControl: ControlWidget {
  /// Stored by the system for every placed control: renaming it removes the
  /// control from Control Center on update.
  static let kind = "quick-actions"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: OpenQuickActionsIntent()) {
        Label("Quick actions", systemImage: "plus")
      }
    }
    .displayName(LocalizedStringResource(stringLiteral: GatherApp.name))
    .description("Show what you need, or add something")
  }
}
