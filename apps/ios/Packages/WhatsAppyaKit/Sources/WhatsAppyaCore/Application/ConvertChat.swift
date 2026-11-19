import Foundation

/// USE CASE — orchestration only; mirrors `packages/core/src/application/ConvertChat.ts`.
public enum ConversionError: Error, Equatable, Sendable {
    case chatFileNotFound, unsupportedFormat, emptyChat
}

public struct ConvertChat: Sendable {
    let parsers: ParserRegistry
    let stages: [any PipelineStage]

    public init(
        parsers: ParserRegistry = Self.defaultParsers(),
        stages: [any PipelineStage] = [MediaStage(), TimestampStage()]
    ) {
        self.parsers = parsers
        self.stages = stages
    }

    public static func defaultParsers() -> ParserRegistry {
        var registry = ParserRegistry()
        registry.register(IosParser())
        registry.register(AndroidParser())
        return registry
    }

    public func execute(
        files: any FileSource,
        ownerName: String? = nil,
        chatPath: String? = nil
    ) async throws -> ChatSession {
        let allPaths = try await files.list()
        let entry: String?
        if let explicit = chatPath, allPaths.contains(explicit) {
            entry = explicit
        } else {
            entry = allPaths.first(where: { $0.lowercased().hasSuffix("_chat.txt") })
                ?? allPaths.first(where: {
                    let lower = $0.lowercased()
                    return lower.hasSuffix(".txt") && (lower.contains("chat") || lower.contains("whatsapp"))
                })
                ?? allPaths.first(where: { $0.lowercased().hasSuffix(".txt") })
        }

        guard let targetPath = entry else {
            throw ConversionError.chatFileNotFound
        }

        let text = try await files.readText(at: targetPath)
        guard let parser = parsers.resolve(for: text) else {
            throw ConversionError.unsupportedFormat
        }

        let raw = parser.parse(text)
        guard !raw.isEmpty else {
            throw ConversionError.emptyChat
        }

        var messages: [ChatMessage] = raw.enumerated().map { idx, m in
            ChatMessage(
                id: "m\(idx)",
                rawDate: m.rawDate,
                rawTime: m.rawTime,
                timestamp: nil,
                sender: m.sender,
                text: m.text,
                kind: m.kind,
                direction: .received,
                isDeleted: m.isDeleted,
                isEdited: m.isEdited,
                attachment: nil
            )
        }

        for stage in stages {
            messages = try await stage.process(messages, files: files)
        }

        var senderCounts: [String: Int] = [:]
        var orderedSenders: [String] = []
        for m in messages {
            if let sender = m.sender {
                if senderCounts[sender] == nil {
                    orderedSenders.append(sender)
                }
                senderCounts[sender, default: 0] += 1
            }
        }

        let participants = resolveParticipants(
            senderCounts: senderCounts,
            orderedSenders: orderedSenders,
            explicitOwner: ownerName,
            chatPath: chatPath ?? targetPath,
            messages: messages
        )

        let resolvedMessages = messages.map { m in
            let dir: Direction = (participants.ownerName != nil && m.sender == participants.ownerName)
                ? .sent
                : .received
            return ChatMessage(
                id: m.id,
                rawDate: m.rawDate,
                rawTime: m.rawTime,
                timestamp: m.timestamp,
                sender: m.sender,
                text: m.text,
                kind: m.kind,
                direction: dir,
                isDeleted: m.isDeleted,
                isEdited: m.isEdited,
                attachment: m.attachment
            )
        }

        return ChatSession(
            schemaVersion: 1,
            title: "Chat with \(participants.contactName)",
            contactName: participants.contactName,
            ownerName: participants.ownerName,
            dateOrder: detectDateOrder(resolvedMessages),
            messages: resolvedMessages,
            senderCounts: senderCounts
        )
    }
}

/// Discovers single or nested multi-chapter archives matching `contracts/archive-tree.schema.json`.
public struct ConvertArchive: Sendable {
    private let convertChat: ConvertChat

    public init(convertChat: ConvertChat = ConvertChat()) {
        self.convertChat = convertChat
    }

    public func execute(files: any FileSource, rootName: String = "Archive") async throws -> ArchiveTree {
        let allPaths = try await files.list()
        var chatPaths = allPaths.filter { path in
            let lower = path.lowercased()
            return lower.hasSuffix(".txt") && (lower.contains("chat") || lower.contains("whatsapp"))
        }
        if chatPaths.isEmpty {
            chatPaths = allPaths.filter { $0.lowercased().hasSuffix(".txt") }
        }

        var summaries: [ChatSummaryNode] = []
        for (idx, path) in chatPaths.enumerated() {
            if let session = try? await convertChat.execute(files: files, chatPath: path) {
                let text = (try? await files.readText(at: path)) ?? ""
                let format: ExportFormat
                switch convertChat.parsers.resolve(for: text)?.id {
                case "ios": format = .ios
                case "android": format = .android
                default: format = .unknown
                }

                summaries.append(
                    ChatSummaryNode(
                        id: "chat-\(idx)",
                        title: session.title,
                        contactName: session.contactName,
                        messageCount: session.messages.count,
                        path: path,
                        exportFormat: format,
                        dateRange: DateRange(
                            start: session.messages.first?.timestamp,
                            end: session.messages.last?.timestamp
                        )
                    )
                )
            }
        }

        let root = ArchiveFolder(id: "root", name: rootName, path: "", children: [], chats: summaries)
        return ArchiveTree(schemaVersion: 1, root: root)
    }
}
