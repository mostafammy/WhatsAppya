import Foundation

/// Single-source-of-truth Swift mirror of `contracts/parser-rules.json`
/// and `packages/core/src/shared/parserRules.ts`.
public enum ParserRules {
    public static let bidiScalarSet: Set<Unicode.Scalar> = [
        "\u{200E}", "\u{200F}", "\u{202A}", "\u{202B}",
        "\u{202C}", "\u{202D}", "\u{202E}", "\u{FEFF}", "\u{00A0}",
    ]

    public static let iosLinePattern =
        #"^\[([0-9]{1,4}[/.-][0-9]{1,2}[/.-][0-9]{1,4})[,\s\u060c]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*(?:[apAP]\.?[mM]\.?|[\u0635\u0645]))?)\]\s*(.*)$"#

    public static let androidLinePattern =
        #"^([0-9]{1,4}[/.-][0-9]{1,2}[/.-][0-9]{1,4})[,\s\u060c]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?(?:\s*(?:[apAP]\.?[mM]\.?|[\u0635\u0645]))?)\s*-\s*(.*)$"#

    public static let editedPattern =
        #"\s*<(?:\s*(?:This message was edited|تم تعديل هذه الرسالة|Ce message a été modifié|Diese Nachricht wurde bearbeitet|Questo messaggio è stato modificato|Este mensaje fue editado|Esta mensagem foi editada)\s*)>\s*$"#

    public static let iosAttachPattern = #"<[^:>]+:\s*([^>]+)>"#
    public static let androidAttachPattern = #"(.+?)\s*\((?:file attached|ملف مرفق)\)"#

    public static let encryptionKeywords: [String] = [
        "الرسائل والمكالمات مشفرة",
        "end-to-end encrypted",
        "chifrés de bout en bout",
        "chiffrés de bout en bout",
        "verschlüsselt",
        "crittografati end-to-end",
    ]

    public static let deletedKeywords: [String] = [
        "This message was deleted",
        "You deleted this message",
        "تم حذف هذه الرسالة",
        "حذف هذه الرسالة",
        "لقد حذفت هذه الرسالة",
    ]

    public static let callKeywords: [String] = [
        "مكالمة صوتية",
        "مكالمة فيديو",
        "Missed voice call",
        "Missed video call",
        "Voice call",
        "Video call",
    ]

    public static let omittedPhrases: [String] = [
        "<Media omitted>",
        "<ملف وسائط تم حذفه>",
        "لم يتم إدراج الصورة",
        "لم يتم إدراج الفيديوهات",
        "لم يتم إدراج ملف صوتي",
        "لم يتم إدراج المستند",
        "لم يتم إدراج الملصق",
        "<ملصق تم استبعاده>",
        "sticker omitted",
        "<sticker omitted>",
        "Sticker omitted",
        "<تم استبعاد الوسائط>",
    ]

    public static let selfPhrases: [String] = [
        "You turned ",
        "You deleted ",
        "You changed ",
        "أنت حذفت",
        "قمت ب",
    ]

    public static let imageExtensions: Set<String> = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".heic"]
    public static let videoExtensions: Set<String> = [".mp4", ".mov", ".avi", ".mkv", ".3gp", ".webm"]
    public static let audioExtensions: Set<String> = [".opus", ".mp3", ".ogg", ".m4a", ".wav", ".aac", ".caf"]
    public static let pdfExtensions: Set<String> = [".pdf"]
    public static let docExtensions: Set<String> = [".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".txt", ".csv", ".zip"]
    public static let stickerExtensions: Set<String> = [".was", ".webp"]

    public static let mimeMap: [String: String] = [
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".opus": "audio/ogg; codecs=opus",
        ".ogg": "audio/ogg",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".pdf": "application/pdf",
        ".was": "application/json",
    ]

    public static func stripBidi(_ text: String) -> String {
        var result = String.UnicodeScalarView()
        result.reserveCapacity(text.unicodeScalars.count)
        for scalar in text.unicodeScalars where !bidiScalarSet.contains(scalar) {
            result.append(scalar)
        }
        return String(result)
    }

    public static func classifyExtension(_ ext: String) -> MediaKind {
        let lower = ext.lowercased()
        if imageExtensions.contains(lower) { return .image }
        if videoExtensions.contains(lower) { return .video }
        if audioExtensions.contains(lower) { return .audio }
        if pdfExtensions.contains(lower) { return .pdf }
        if docExtensions.contains(lower) { return .document }
        return .file
    }

    public static func resolveMimeType(_ ext: String) -> String {
        mimeMap[ext.lowercased()] ?? "application/octet-stream"
    }

    static func compileRegex(_ pattern: String, options: NSRegularExpression.Options = []) -> NSRegularExpression {
        // Patterns are compile-time verified static strings
        try! NSRegularExpression(pattern: pattern, options: options)
    }
}
