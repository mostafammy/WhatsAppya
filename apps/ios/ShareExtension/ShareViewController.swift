import UIKit
import UniformTypeIdentifiers

/// Receives the export zip from WhatsApp's share sheet.
/// Design rule: extensions have tight memory limits, so we DO NOT parse here —
/// we copy the file into the shared App Group container and hand off to the main app.
final class ShareViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let provider = item.attachments?.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.zip.identifier) })
        else { return complete() }

        provider.loadFileRepresentation(forTypeIdentifier: UTType.zip.identifier) { [weak self] url, _ in
            if let url { try? InboxStore.shared.enqueue(url) }
            self?.complete()
        }
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}

/// Writes incoming exports to `group.app.whatsappya/Inbox`, picked up by the app on next launch.
struct InboxStore {
    static let shared = InboxStore()
    private let groupID = "group.app.whatsappya"

    func enqueue(_ source: URL) throws {
        guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID) else { return }
        let inbox = container.appendingPathComponent("Inbox", isDirectory: true)
        try FileManager.default.createDirectory(at: inbox, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: source, to: inbox.appendingPathComponent(UUID().uuidString + ".zip"))
    }
}
