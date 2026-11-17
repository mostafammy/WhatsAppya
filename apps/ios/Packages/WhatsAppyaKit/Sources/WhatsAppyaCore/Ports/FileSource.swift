import Foundation

/// PORT — the core never depends on a concrete zip library or file system.
public protocol FileSource: Sendable {
    func list() async throws -> [String]
    func readData(at path: String) async throws -> Data
}
