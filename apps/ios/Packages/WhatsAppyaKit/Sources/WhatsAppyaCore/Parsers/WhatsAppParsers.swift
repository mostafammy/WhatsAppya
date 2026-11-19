import Foundation

/// iOS WhatsApp Chat Parser Strategy (`[DD/MM/YY, HH:MM:SS AM] Sender: Message`).
/// Mirrors `packages/core/src/parsers/ios/IosParser.ts` 1:1.
public struct IosParser: ChatParser {
    public let id = "ios"

    public init() {}

    public func canHandle(_ sampleLines: [Substring]) -> Bool {
        let regex = ParserRules.compileRegex(ParserRules.iosLinePattern)
        var matches = 0
        var total = 0
        for line in sampleLines {
            let clean = ParserRules.stripBidi(String(line)).trimmingCharacters(in: .whitespacesAndNewlines)
            if clean.isEmpty { continue }
            total += 1
            let ns = clean as NSString
            if regex.firstMatch(in: clean, range: NSRange(location: 0, length: ns.length)) != nil {
                matches += 1
            }
        }
        return total > 0 && Double(matches) / Double(total) >= 0.25
    }

    public func parse(_ text: String) -> [RawMessage] {
        let lineRegex = ParserRules.compileRegex(ParserRules.iosLinePattern)
        let editedRegex = ParserRules.compileRegex(
            ParserRules.editedPattern,
            options: [.caseInsensitive, .anchorsMatchLines]
        )
        return parseWithRegex(text: text, lineRegex: lineRegex, editedRegex: editedRegex)
    }
}

/// Android WhatsApp Chat Parser Strategy (`DD/MM/YYYY, HH:MM - Sender: Message`).
/// Mirrors `packages/core/src/parsers/android/AndroidParser.ts` 1:1.
public struct AndroidParser: ChatParser {
    public let id = "android"

    public init() {}

    public func canHandle(_ sampleLines: [Substring]) -> Bool {
        let regex = ParserRules.compileRegex(ParserRules.androidLinePattern)
        var matches = 0
        var total = 0
        for line in sampleLines {
            let clean = ParserRules.stripBidi(String(line)).trimmingCharacters(in: .whitespacesAndNewlines)
            if clean.isEmpty { continue }
            total += 1
            let ns = clean as NSString
            if regex.firstMatch(in: clean, range: NSRange(location: 0, length: ns.length)) != nil {
                matches += 1
            }
        }
        return total > 0 && Double(matches) / Double(total) >= 0.25
    }

    public func parse(_ text: String) -> [RawMessage] {
        let lineRegex = ParserRules.compileRegex(ParserRules.androidLinePattern)
        let editedRegex = ParserRules.compileRegex(
            ParserRules.editedPattern,
            options: [.caseInsensitive, .anchorsMatchLines]
        )
        return parseWithRegex(text: text, lineRegex: lineRegex, editedRegex: editedRegex)
    }
}

private func parseWithRegex(
    text: String,
    lineRegex: NSRegularExpression,
    editedRegex: NSRegularExpression
) -> [RawMessage] {
    let lines = text.components(separatedBy: CharacterSet.newlines)
    var messages: [RawMessage] = []
    var current: (date: String, time: String, rawRest: String)?

    for rawLine in lines {
        let cleanLine = ParserRules.stripBidi(rawLine).trimmingCharacters(in: .whitespacesAndNewlines)
        let ns = cleanLine as NSString
        if let match = lineRegex.firstMatch(in: cleanLine, range: NSRange(location: 0, length: ns.length)),
           match.numberOfRanges >= 4
        {
            if let cur = current {
                messages.append(buildRawMessage(cur, editedRegex: editedRegex))
            }
            let date = ns.substring(with: match.range(at: 1))
            let time = ns.substring(with: match.range(at: 2))
            let rest = ns.substring(with: match.range(at: 3))
            current = (date, time, rest)
            continue
        }

        if var cur = current, !rawLine.isEmpty {
            cur.rawRest += "\n" + rawLine
            current = cur
        }
    }

    if let cur = current {
        messages.append(buildRawMessage(cur, editedRegex: editedRegex))
    }

    return messages
}

private func buildRawMessage(
    _ data: (date: String, time: String, rawRest: String),
    editedRegex: NSRegularExpression
) -> RawMessage {
    let isEncryption = ParserRules.encryptionKeywords.contains { data.rawRest.contains($0) }
    let colonIndex = data.rawRest.firstIndex(of: ":")

    if isEncryption {
        let text: String
        if let idx = colonIndex {
            text = String(data.rawRest[data.rawRest.index(after: idx)...])
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            text = data.rawRest.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return RawMessage(
            rawDate: data.date,
            rawTime: data.time,
            sender: nil,
            text: text,
            kind: .system
        )
    }

    if let idx = colonIndex {
        let sender = String(data.rawRest[..<idx]).trimmingCharacters(in: .whitespacesAndNewlines)
        var text = String(data.rawRest[data.rawRest.index(after: idx)...])
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let nsText = text as NSString
        let fullRange = NSRange(location: 0, length: nsText.length)
        let isEdited = editedRegex.firstMatch(in: text, range: fullRange) != nil
        if isEdited {
            text = editedRegex
                .stringByReplacingMatches(in: text, range: fullRange, withTemplate: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let isDeleted = ParserRules.deletedKeywords.contains { text.contains($0) }
        let isCall = ParserRules.callKeywords.contains { text.contains($0) }

        return RawMessage(
            rawDate: data.date,
            rawTime: data.time,
            sender: sender,
            text: text,
            kind: isCall ? .call : .message,
            isDeleted: isDeleted,
            isEdited: isEdited
        )
    }

    return RawMessage(
        rawDate: data.date,
        rawTime: data.time,
        sender: nil,
        text: data.rawRest.trimmingCharacters(in: .whitespacesAndNewlines),
        kind: .system
    )
}
