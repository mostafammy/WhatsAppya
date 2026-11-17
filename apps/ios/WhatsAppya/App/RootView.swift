import SwiftUI

/// Composition root for the iOS app: wires concrete adapters into WhatsAppyaCore use cases.
struct RootView: View {
    var body: some View {
        NavigationStack { ImportView() }
    }
}
