import AppIntents
import SwiftUI
import WidgetKit

/// A Control Center, Lock Screen and Action Button control (iOS 18) that opens
/// Gather on the quick-actions sheet, or on the Loyalty card that was open
/// (APP-443), through `OpenQuickActionsIntent`.
///
/// Named for what it does, "Quick actions" (APP-443), because the Action
/// Button settings show only this name. On the preview and development builds
/// the variant follows in brackets, "Quick actions (Preview)", so the controls
/// of side-by-side variants (ADR 0045) can still be told apart.
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
    .displayName(Self.displayName)
    .description("Open your card, or quickly add something")
  }

  static var displayName: LocalizedStringResource {
    guard let variant = GatherApp.variant else { return "Quick actions" }
    return "Quick actions (\(variant))"
  }
}
