import SwiftUI
import WhatsAppyaCore

/// Native SwiftUI counterpart to `<wa-message-list>` with lazy rendering and `.searchable` filtering.
struct ChatSessionView: View {
    let session: ChatSession
    @State private var searchQuery = ""
    @State private var isStatsPresented = false

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
                ForEach(Array(filteredMessages.enumerated()), id: \.element.id) { idx, message in
                    let prevDate = idx > 0 ? dateKey(for: filteredMessages[idx - 1]) : ""
                    if dateKey(for: message) != prevDate {
                        Text(message.rawDate)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 5)
                            .background(.ultraThinMaterial, in: Capsule())
                            .padding(.top, 10)
                            .padding(.bottom, 4)
                    }
                    MessageRowView(message: message)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .navigationTitle(session.contactName)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchQuery, prompt: "Search messages")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    isStatsPresented = true
                } label: {
                    Image(systemName: "chart.bar.xaxis")
                }
                .accessibilityLabel("Chat Insights")
            }
        }
        .sheet(isPresented: $isStatsPresented) {
            ChatStatsView(session: session)
        }
    }

    private func dateKey(for message: ChatMessage) -> String {
        if let ts = message.timestamp, ts.count >= 10 {
            return String(ts.prefix(10))
        }
        return message.rawDate
    }
}

private struct MessageRowView: View {
    let message: ChatMessage

    private var formattedTime: String {
        let cleaned = message.rawTime
            .replacingOccurrences(of: "\u{00A0}", with: " ")
            .replacingOccurrences(of: "ص", with: "AM")
            .replacingOccurrences(of: "م", with: "PM")
        let parts = cleaned.split(separator: ":", maxSplits: 2)
        if parts.count == 3 {
            let suffix = parts[2].drop(while: { $0.isNumber })
            return "\(parts[0]):\(parts[1])\(suffix)"
        }
        return cleaned
    }

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
                    Text(message.isEdited ? "Edited · \(formattedTime)" : formattedTime)
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
