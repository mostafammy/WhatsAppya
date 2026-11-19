import SwiftUI
import UniformTypeIdentifiers
import WhatsAppyaCore

/// Imports from Files, drag-and-drop, or folders/exports handed off by the Share Extension via the App Group.
struct ImportView: View {
    let onImported: (ArchiveTree, ChatSession, any FileSource) -> Void

    @State private var isPickerPresented = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 16) {
            ContentUnavailableView(
                "Export a chat from WhatsApp",
                systemImage: "square.and.arrow.up",
                description: Text("Chat → Export Chat → WhatsAppya, or pick an export folder from Files.")
            )
            Button("Choose Export Folder") {
                isPickerPresented = true
            }
            .buttonStyle(.borderedProminent)

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
        .padding()
        .fileImporter(
            isPresented: $isPickerPresented,
            allowedContentTypes: [.folder, .plainText],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                Task { await loadExport(from: url) }
            case .failure(let error):
                errorMessage = error.localizedDescription
            }
        }
        .task {
            await checkSharedAppGroupInbox()
        }
    }

    @MainActor
    private func loadExport(from url: URL) async {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }

        do {
            let folderURL = url.hasDirectoryPath ? url : url.deletingLastPathComponent()
            let source = DirectoryFileSource(rootURL: folderURL)
            let tree = try await ConvertArchive().execute(
                files: source,
                rootName: folderURL.lastPathComponent
            )
            let firstPath = tree.root.chats.first?.path
            let session = try await ConvertChat().execute(files: source, chatPath: firstPath)
            errorMessage = nil
            onImported(tree, session, source)
        } catch {
            errorMessage = "Could not import export: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func checkSharedAppGroupInbox() async {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.app.whatsappya"
        ) else { return }
        let inbox = container.appendingPathComponent("Inbox", isDirectory: true)
        guard let items = try? FileManager.default.contentsOfDirectory(
            at: inbox,
            includingPropertiesForKeys: nil
        ), let first = items.first else { return }
        await loadExport(from: first)
    }
}
