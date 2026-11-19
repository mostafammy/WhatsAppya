import Foundation

public struct MediaStage: PipelineStage {
    public let name = "MediaStage"

    public init() {}

    public func process(_ messages: [ChatMessage], files: any FileSource) async throws -> [ChatMessage] {
        let paths = try await files.list()
        var fileIndex: [String: String] = [:]
        for path in paths {
            let normalized = path.replacingOccurrences(of: "\\", with: "/")
            let base = normalized.split(separator: "/").last.map(String.init) ?? normalized
            fileIndex[base.lowercased()] = path
            fileIndex[normalized.lowercased()] = path
        }

        let iosAttachRegex = ParserRules.compileRegex(ParserRules.iosAttachPattern)
        let androidAttachRegex = ParserRules.compileRegex(
            ParserRules.androidAttachPattern,
            options: [.caseInsensitive]
        )
        let editedRegex = ParserRules.compileRegex(
            ParserRules.editedPattern,
            options: [.caseInsensitive, .anchorsMatchLines]
        )

        var output: [ChatMessage] = []
        output.reserveCapacity(messages.count)

        for msg in messages {
            var cleanText = msg.text
            var attachment: Attachment? = nil
            var isOmittedMarker = false

            for phrase in ParserRules.omittedPhrases where cleanText.contains(phrase) {
                cleanText = ParserRules.stripBidi(cleanText.replacingOccurrences(of: phrase, with: ""))
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                attachment = Attachment(
                    fileName: phrase,
                    kind: .omitted,
                    mimeType: "application/octet-stream",
                    sizeBytes: 0,
                    isOmitted: true
                )
                isOmittedMarker = true
                break
            }

            if !isOmittedMarker {
                var candidateFilename: String? = nil

                let ns1 = cleanText as NSString
                if let match = iosAttachRegex.firstMatch(in: cleanText, range: NSRange(location: 0, length: ns1.length)),
                   match.numberOfRanges >= 2
                {
                    let candidate = ParserRules.stripBidi(ns1.substring(with: match.range(at: 1)))
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    if fileIndex[candidate.lowercased()] != nil {
                        candidateFilename = candidate
                        cleanText = ParserRules.stripBidi(
                            iosAttachRegex.stringByReplacingMatches(
                                in: cleanText,
                                range: NSRange(location: 0, length: ns1.length),
                                withTemplate: ""
                            )
                        ).trimmingCharacters(in: .whitespacesAndNewlines)
                    }
                }

                if candidateFilename == nil {
                    let ns2 = cleanText as NSString
                    if let match = androidAttachRegex.firstMatch(in: cleanText, range: NSRange(location: 0, length: ns2.length)),
                       match.numberOfRanges >= 2
                    {
                        let candidate = ParserRules.stripBidi(ns2.substring(with: match.range(at: 1)))
                            .trimmingCharacters(in: .whitespacesAndNewlines)
                        if fileIndex[candidate.lowercased()] != nil {
                            candidateFilename = candidate
                            cleanText = ParserRules.stripBidi(
                                androidAttachRegex.stringByReplacingMatches(
                                    in: cleanText,
                                    range: NSRange(location: 0, length: ns2.length),
                                    withTemplate: ""
                                )
                            ).trimmingCharacters(in: .whitespacesAndNewlines)
                        }
                    }
                }

                let ns3 = cleanText as NSString
                if editedRegex.firstMatch(in: cleanText, range: NSRange(location: 0, length: ns3.length)) != nil {
                    cleanText = ParserRules.stripBidi(
                        editedRegex.stringByReplacingMatches(
                            in: cleanText,
                            range: NSRange(location: 0, length: ns3.length),
                            withTemplate: ""
                        )
                    ).trimmingCharacters(in: .whitespacesAndNewlines)
                }

                if let fileName = candidateFilename, let actualPath = fileIndex[fileName.lowercased()] {
                    let size = (try? await files.sizeBytes(at: actualPath)) ?? 0
                    let ext = (fileName as NSString).pathExtension.isEmpty
                        ? ""
                        : "." + (fileName as NSString).pathExtension.lowercased()
                    let upper = fileName.uppercased()
                    let isSticker = ParserRules.stickerExtensions.contains(ext)
                        || upper.hasPrefix("STK-")
                        || upper.contains("-STICKER-")
                    let kind: MediaKind = isSticker ? .sticker : ParserRules.classifyExtension(ext)
                    let mimeType = ParserRules.resolveMimeType(ext)
                    let isAnimated: Bool? = (isSticker && ext == ".webp") ? true : nil

                    attachment = Attachment(
                        fileName: fileName,
                        kind: kind,
                        mimeType: mimeType,
                        sizeBytes: size,
                        isOmitted: false,
                        isAnimated: isAnimated
                    )
                }
            }

            output.append(
                ChatMessage(
                    id: msg.id,
                    rawDate: msg.rawDate,
                    rawTime: msg.rawTime,
                    timestamp: msg.timestamp,
                    sender: msg.sender,
                    text: cleanText,
                    kind: msg.kind,
                    direction: msg.direction,
                    isDeleted: msg.isDeleted,
                    isEdited: msg.isEdited,
                    attachment: attachment ?? msg.attachment
                )
            )
        }

        return output
    }
}

public struct TimestampStage: PipelineStage {
    public let name = "TimestampStage"

    public init() {}

    public func process(_ messages: [ChatMessage], files: any FileSource) async throws -> [ChatMessage] {
        let order = detectDateOrder(messages)
        return messages.map { msg in
            ChatMessage(
                id: msg.id,
                rawDate: msg.rawDate,
                rawTime: msg.rawTime,
                timestamp: parseIsoTimestamp(rawDate: msg.rawDate, rawTime: msg.rawTime, order: order),
                sender: msg.sender,
                text: msg.text,
                kind: msg.kind,
                direction: msg.direction,
                isDeleted: msg.isDeleted,
                isEdited: msg.isEdited,
                attachment: msg.attachment
            )
        }
    }
}

public func detectDateOrder(_ messages: [ChatMessage]) -> DateOrder {
    var hasDayFirst = false
    var hasMonthFirst = false

    for msg in messages {
        let clean = ParserRules.stripBidi(msg.rawDate).trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = clean.components(separatedBy: CharacterSet(charactersIn: "/.-"))
        if parts.count == 3, let p1 = Int(parts[0]), let p2 = Int(parts[1]) {
            if p1 > 12 { hasDayFirst = true }
            if p2 > 12 { hasMonthFirst = true }
        }
    }

    return (hasMonthFirst && !hasDayFirst) ? .monthFirst : .dayFirst
}

public func parseIsoTimestamp(rawDate: String, rawTime: String, order: DateOrder) -> String? {
    let cleanDate = ParserRules.stripBidi(rawDate).trimmingCharacters(in: .whitespacesAndNewlines)
    let dateParts = cleanDate.components(separatedBy: CharacterSet(charactersIn: "/.-"))
    guard dateParts.count == 3,
          let p1 = Int(dateParts[0]),
          let p2 = Int(dateParts[1]),
          var year = Int(dateParts[2])
    else { return nil }

    if year < 100 { year += 2000 }
    let month = order == .monthFirst ? p1 : p2
    let day = order == .monthFirst ? p2 : p1
    guard (1...12).contains(month), (1...31).contains(day) else { return nil }

    let cleanTime = ParserRules.stripBidi(rawTime).trimmingCharacters(in: .whitespacesAndNewlines)
    let timeRegex = ParserRules.compileRegex(
        #"^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(?:([apAP]\.?[mM]\.?)|([صم])))?"#
    )
    let nsTime = cleanTime as NSString
    guard let match = timeRegex.firstMatch(in: cleanTime, range: NSRange(location: 0, length: nsTime.length)),
          match.range(at: 1).location != NSNotFound,
          match.range(at: 2).location != NSNotFound,
          var hours = Int(nsTime.substring(with: match.range(at: 1))),
          let minutes = Int(nsTime.substring(with: match.range(at: 2)))
    else { return nil }

    let seconds: Int
    if match.range(at: 3).location != NSNotFound {
        seconds = Int(nsTime.substring(with: match.range(at: 3))) ?? 0
    } else {
        seconds = 0
    }

    let latinAmPm: String? = match.range(at: 4).location != NSNotFound
        ? nsTime.substring(with: match.range(at: 4)).lowercased().replacingOccurrences(of: ".", with: "")
        : nil
    let arabicAmPm: String? = match.range(at: 5).location != NSNotFound
        ? nsTime.substring(with: match.range(at: 5))
        : nil

    let isPm = latinAmPm == "pm" || arabicAmPm == "م"
    let isAm = latinAmPm == "am" || arabicAmPm == "ص"

    if isPm && hours < 12 { hours += 12 }
    if isAm && hours == 12 { hours = 0 }

    return String(
        format: "%04d-%02d-%02dT%02d:%02d:%02d.000Z",
        year, month, day, hours, minutes, seconds
    )
}

public func resolveParticipants(
    senderCounts: [String: Int],
    orderedSenders: [String],
    explicitOwner: String?,
    chatPath: String?,
    messages: [ChatMessage]
) -> (ownerName: String?, contactName: String) {
    if let explicit = explicitOwner {
        let other = orderedSenders.first { $0 != explicit } ?? "WhatsApp Chat"
        return (explicit, other)
    }

    if let chatPath, orderedSenders.count == 2 {
        let normalized = chatPath.replacingOccurrences(of: "\\", with: "/")
        var parts = normalized.split(separator: "/").map(String.init)
        let fileName = parts.popLast() ?? ""
        let folderName = parts.popLast() ?? ""
        let stem = (fileName as NSString).deletingPathExtension
        let targets = [folderName, fileName, stem]

        if let matched = orderedSenders.first(where: { sender in
            targets.contains { $0.contains(sender) }
        }) {
            let owner = orderedSenders.first { $0 != matched }
            return (owner, matched)
        }
    }

    if orderedSenders.count == 2 {
        for msg in messages {
            if let sender = msg.sender, senderCounts[sender] != nil {
                if ParserRules.selfPhrases.contains(where: { msg.text.hasPrefix($0) }) {
                    let other = orderedSenders.first { $0 != sender } ?? "WhatsApp Chat"
                    return (sender, other)
                }
            }
        }
    }

    if let first = orderedSenders.first {
        var minSender = first
        var minCount = Int.max
        for s in orderedSenders {
            let count = senderCounts[s] ?? 0
            if count < minCount {
                minCount = count
                minSender = s
            }
        }
        let other = orderedSenders.first { $0 != minSender } ?? "WhatsApp Chat"
        return (minSender, other)
    }

    return (nil, "WhatsApp Chat")
}
