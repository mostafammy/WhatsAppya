import SwiftUI

/// Imports from Files, drag-and-drop, or zips handed off by the Share Extension via the App Group.
struct ImportView: View {
    var body: some View {
        ContentUnavailableView("Export a chat from WhatsApp",
                               systemImage: "square.and.arrow.up",
                               description: Text("Chat → Export Chat → WhatsAppya"))
    }
}
