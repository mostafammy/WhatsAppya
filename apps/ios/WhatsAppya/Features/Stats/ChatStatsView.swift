import SwiftUI
import WhatsAppyaCore

/// Native SwiftUI Chat Insights sheet displaying on-device message counts,
/// participant shares, and attachment breakdown.
struct ChatStatsView: View {
    let session: ChatSession
    @Environment(\.dismiss) private var dismiss

    private var userMessageCount: Int {
        session.messages.filter { $0.kind == .message }.count
    }

    private var sortedParticipants: [(name: String, count: Int)] {
        session.senderCounts.sorted { $0.value > $1.value }.map { ($0.key, $0.value) }
    }

    private var mediaBreakdown: [(kind: String, count: Int)] {
        var counts: [String: Int] = [:]
        for msg in session.messages {
            if let att = msg.attachment {
                let key = att.isOmitted ? "omitted" : att.kind.rawValue
                counts[key, default: 0] += 1
            }
        }
        return counts.sorted { $0.value > $1.value }.map { ($0.key, $0.value) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Overview") {
                    LabeledContent("Total Messages", value: "\(session.messages.count)")
                    LabeledContent("Calls", value: "\(session.messages.filter { $0.kind == .call }.count)")
                    LabeledContent("Edited", value: "\(session.messages.filter(\.isEdited).count)")
                }

                Section("Participants") {
                    ForEach(sortedParticipants, id: \.name) { entry in
                        let pct = userMessageCount > 0
                            ? Int((Double(entry.count) / Double(userMessageCount)) * 100)
                            : 0
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(entry.name).font(.headline)
                                Spacer()
                                Text("\(entry.count) (\(pct)%)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            ProgressView(value: Double(entry.count), total: Double(max(1, userMessageCount)))
                        }
                    }
                }

                if !mediaBreakdown.isEmpty {
                    Section("Media") {
                        ForEach(mediaBreakdown, id: \.kind) { item in
                            LabeledContent(item.kind.capitalized, value: "\(item.count)")
                        }
                    }
                }
            }
            .navigationTitle("Chat Insights")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
