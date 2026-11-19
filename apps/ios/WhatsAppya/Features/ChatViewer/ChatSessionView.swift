import SwiftUI
import WhatsAppyaCore

/// Native SwiftUI counterpart to `<wa-message-list>` with lazy rendering and `.searchable` filtering.
struct ChatSessionView: View {
    let session: ChatSession
    @State private var searchQuery = ""

    private var filteredMessages: [ChatMessage] {
        guard !searchQuery.isEmpty else { return session.messages }
        return session.messages.filter {
            $0.text.localizedCaseInsensitiveContains(searchQuery) ||
            ($0.sender?.localizedCaseInsensitiveContains(searchQuery) ?? false)
        }
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 6) {
                ForEach(filteredMessages) { message in
                    MessageRowView(message: message)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .navigationTitle(session.contactName)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchQuery, prompt: "Search messages")
    }
}

private struct MessageRowView: View {
    let message: ChatMessage

    var body: some View {
        if message.kind == .system || message.kind == .call {
            Text(message.kind == .call ? "📞 \(message.text)" : message.text)
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(.ultraThinMaterial, in: Capsule())
        } else {
            HStack {
                if message.direction == .sent { Spacer(minLength: 48) }
                VStack(alignment: .leading, spacing: 4) {
                    if message.direction == .received, let sender = message.sender {
                        Text(sender)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color.accentColor)
                    }
                    if let att = message.attachment {
                        Label(att.fileName, systemImage: "paperclip")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if !message.text.isEmpty {
                        Text(message.text)
                            .font(.body)
                    }
                    Text(message.isEdited ? "Edited · \(message.rawTime)" : message.rawTime)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    message.direction == .sent
                        ? Color.green.opacity(0.22)
                        : Color(.secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                )
                if message.direction == .received { Spacer(minLength: 48) }
            }
        }
    }
}
