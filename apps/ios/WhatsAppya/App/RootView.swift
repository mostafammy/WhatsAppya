import SwiftUI
import WhatsAppyaCore

/// Adaptive composition root for the iOS app:
/// - Shows `ImportView` until an archive is loaded.
/// - Single chat (`sessionCount <= 1`): renders `ChatSessionView` directly in a `NavigationStack`.
/// - Multi-chapter curriculum (`sessionCount > 1`): renders a `NavigationSplitView` sidebar.
struct RootView: View {
    @State private var archiveTree: ArchiveTree?
    @State private var activeSession: ChatSession?
    @State private var activeFileSource: (any FileSource)?
    @State private var selectedChatID: String?

    var body: some View {
        Group {
            if let tree = archiveTree {
                let totalChats = countChats(in: tree.root)
                if totalChats <= 1, let session = activeSession {
                    NavigationStack {
                        ChatSessionView(session: session)
                    }
                } else {
                    NavigationSplitView {
                        List(selection: $selectedChatID) {
                            ArchiveFolderSection(folder: tree.root)
                        }
                        .navigationTitle(tree.root.name)
                    } detail: {
                        if let session = activeSession {
                            ChatSessionView(session: session)
                        } else {
                            ContentUnavailableView(
                                "Select a Chapter",
                                systemImage: "bubble.left.and.bubble.right"
                            )
                        }
                    }
                    .onChange(of: selectedChatID) { _, newID in
                        guard let newID, let source = activeFileSource,
                              let chat = findChat(id: newID, in: tree.root)
                        else { return }
                        Task {
                            if let loaded = try? await ConvertChat().execute(
                                files: source,
                                chatPath: chat.path
                            ) {
                                activeSession = loaded
                            }
                        }
                    }
                }
            } else {
                NavigationStack {
                    ImportView { tree, session, source in
                        archiveTree = tree
                        activeSession = session
                        activeFileSource = source
                        selectedChatID = tree.root.chats.first?.id
                    }
                }
            }
        }
    }

    private func countChats(in folder: ArchiveFolder) -> Int {
        folder.chats.count + folder.children.reduce(0) { $0 + countChats(in: $1) }
    }

    private func findChat(id: String, in folder: ArchiveFolder) -> ChatSummaryNode? {
        if let found = folder.chats.first(where: { $0.id == id }) { return found }
        for child in folder.children {
            if let found = findChat(id: id, in: child) { return found }
        }
        return nil
    }
}

private struct ArchiveFolderSection: View {
    let folder: ArchiveFolder

    var body: some View {
        ForEach(folder.chats) { chat in
            NavigationLink(value: chat.id) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(chat.contactName)
                        .font(.headline)
                    Text("\(chat.messageCount) messages")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        ForEach(folder.children) { child in
            Section(child.name) {
                ArchiveFolderSection(folder: child)
            }
        }
    }
}
