import Foundation

/// PORT — the core never depends on a concrete zip library or file system.
public protocol FileSource: Sendable {
    func list() async throws -> [String]
    func readData(at path: String) async throws -> Data
    func sizeBytes(at path: String) async throws -> Int
}

public extension FileSource {
    func sizeBytes(at path: String) async throws -> Int {
        try await readData(at: path).count
    }

    func readText(at path: String) async throws -> String {
        let data = try await readData(at: path)
        return String(decoding: data, as: UTF8.self)
    }
}

/// Concrete Foundation `FileManager` adapter for reading local or App-Group directories.
public struct DirectoryFileSource: FileSource {
    public let rootURL: URL

    public init(rootURL: URL) {
        self.rootURL = rootURL
    }

    public func list() async throws -> [String] {
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(
            at: rootURL,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var results: [String] = []
        let rootPath = rootURL.standardizedFileURL.path
        while let item = enumerator.nextObject() as? URL {
            let values = try item.resourceValues(forKeys: [.isRegularFileKey])
            if values.isRegularFile == true {
                let fullPath = item.standardizedFileURL.path
                if fullPath.hasPrefix(rootPath + "/") {
                    results.append(String(fullPath.dropFirst(rootPath.count + 1)))
                }
            }
        }
        return results
    }

    public func readData(at path: String) async throws -> Data {
        try Data(contentsOf: rootURL.appendingPathComponent(path))
    }

    public func sizeBytes(at path: String) async throws -> Int {
        let attrs = try FileManager.default.attributesOfItem(
            atPath: rootURL.appendingPathComponent(path).path
        )
        return (attrs[.size] as? NSNumber)?.intValue ?? 0
    }
}
