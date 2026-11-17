import SwiftUI
import WidgetKit

/// Everything the widget extension offers (APP-207). Today only the control;
/// a Home Screen widget would be listed here too.
@main
struct GatherWidgets: WidgetBundle {
  var body: some Widget {
    QuickActionsControl()
  }
}
