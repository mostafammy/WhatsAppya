import Compression
import Foundation

public struct ZipEntryMeta: Sendable {
    public let path: String
    public let uncompressedSize: Int
    public let compressedSize: Int
    public let compressionMethod: UInt16
    public let localHeaderOffset: UInt64
}

public enum ZipFileError: Error, Sendable {
    case invalidArchive(String)
    case entryNotFound(String)
    case unsupportedCompression(UInt16)
    case decompressionFailed(String)
}

/// Pure-Swift, zero-dependency Central Directory ZIP `FileSource`.
/// Tail-slices the last 65,557 bytes to index entries without buffering the archive into RAM,
/// mirroring `packages/platform-web/src/zip/ZipFileSource.ts`.
public final class ZipFileSource: FileSource, @unchecked Sendable {
    private let fileURL: URL
    private let entries: [String: ZipEntryMeta]
    private let orderedPaths: [String]

    public init(fileURL: URL) throws {
        self.fileURL = fileURL
        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }

        let totalSize = try handle.seekToEnd()
        guard totalSize >= 22 else {
            throw ZipFileError.invalidArchive("Archive too small for EOCD")
        }

        // 1. Read trailing up to 65,557 bytes to locate EOCD (0x06054b50)
        let tailLen = min(totalSize, 65_557)
        try handle.seek(toOffset: totalSize - tailLen)
        guard let tailData = try handle.read(upToCount: Int(tailLen)), tailData.count >= 22 else {
            throw ZipFileError.invalidArchive("Unable to read ZIP tail")
        }

        var eocdPos = -1
        for i in stride(from: tailData.count - 22, through: 0, by: -1) {
            if readUInt32LE(tailData, at: i) == 0x0605_4b50 {
                eocdPos = i
                break
            }
        }
        guard eocdPos >= 0 else {
            throw ZipFileError.invalidArchive("EOCD record not found")
        }

        var cdSize = UInt64(readUInt32LE(tailData, at: eocdPos + 12))
        var cdOffset = UInt64(readUInt32LE(tailData, at: eocdPos + 16))

        // Check for Zip64 Locator 20 bytes before EOCD
        let locPos = eocdPos - 20
        if locPos >= 0 && readUInt32LE(tailData, at: locPos) == 0x0706_4b50 {
            let zip64Offset = readUInt64LE(tailData, at: locPos + 8)
            try handle.seek(toOffset: zip64Offset)
            if let z64 = try handle.read(upToCount: 56), z64.count >= 56,
               readUInt32LE(z64, at: 0) == 0x0606_4b50
            {
                cdSize = readUInt64LE(z64, at: 40)
                cdOffset = readUInt64LE(z64, at: 48)
            }
        }

        // 2. Read and parse Central Directory
        try handle.seek(toOffset: cdOffset)
        guard let cdData = try handle.read(upToCount: Int(cdSize)) else {
            throw ZipFileError.invalidArchive("Unable to read Central Directory")
        }

        var map: [String: ZipEntryMeta] = [:]
        var paths: [String] = []
        var cursor = 0

        while cursor + 46 <= cdData.count {
            guard readUInt32LE(cdData, at: cursor) == 0x0201_4b50 else { break }

            let method = readUInt16LE(cdData, at: cursor + 10)
            var compSize = UInt64(readUInt32LE(cdData, at: cursor + 20))
            var uncompSize = UInt64(readUInt32LE(cdData, at: cursor + 24))
            let nameLen = Int(readUInt16LE(cdData, at: cursor + 28))
            let extraLen = Int(readUInt16LE(cdData, at: cursor + 30))
            let commentLen = Int(readUInt16LE(cdData, at: cursor + 32))
            var lfhOffset = UInt64(readUInt32LE(cdData, at: cursor + 42))

            let nameStart = cursor + 46
            guard nameStart + nameLen <= cdData.count else { break }
            let name = String(decoding: cdData[nameStart..<(nameStart + nameLen)], as: UTF8.self)

            // Parse Zip64 extra field (0x0001) if needed
            var extraCursor = nameStart + nameLen
            let extraEnd = min(extraCursor + extraLen, cdData.count)
            while extraCursor + 4 <= extraEnd {
                let extraId = readUInt16LE(cdData, at: extraCursor)
                let extraDataSize = Int(readUInt16LE(cdData, at: extraCursor + 2))
                extraCursor += 4
                if extraId == 0x0001 {
                    var f = extraCursor
                    if uncompSize == 0xFFFF_FFFF && f + 8 <= extraEnd {
                        uncompSize = readUInt64LE(cdData, at: f); f += 8
                    }
                    if compSize == 0xFFFF_FFFF && f + 8 <= extraEnd {
                        compSize = readUInt64LE(cdData, at: f); f += 8
                    }
                    if lfhOffset == 0xFFFF_FFFF && f + 8 <= extraEnd {
                        lfhOffset = readUInt64LE(cdData, at: f)
                    }
                }
                extraCursor += extraDataSize
            }

            cursor = nameStart + nameLen + extraLen + commentLen
            if name.hasSuffix("/") { continue }

            let meta = ZipEntryMeta(
                path: name,
                uncompressedSize: Int(uncompSize),
                compressedSize: Int(compSize),
                compressionMethod: method,
                localHeaderOffset: lfhOffset
            )
            map[name] = meta
            map[name.lowercased()] = meta
            paths.append(name)
        }

        self.entries = map
        self.orderedPaths = paths
    }

    public func list() async throws -> [String] {
        orderedPaths
    }

    public func sizeBytes(at path: String) async throws -> Int {
        guard let meta = entries[path] ?? entries[path.lowercased()] else {
            throw ZipFileError.entryNotFound(path)
        }
        return meta.uncompressedSize
    }

    public func readData(at path: String) async throws -> Data {
        guard let meta = entries[path] ?? entries[path.lowercased()] else {
            throw ZipFileError.entryNotFound(path)
        }

        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }

        try handle.seek(toOffset: meta.localHeaderOffset)
        guard let lfh = try handle.read(upToCount: 30), lfh.count == 30,
              readUInt32LE(lfh, at: 0) == 0x0403_4b50
        else {
            throw ZipFileError.invalidArchive("Invalid local file header for \(path)")
        }

        let localNameLen = UInt64(readUInt16LE(lfh, at: 26))
        let localExtraLen = UInt64(readUInt16LE(lfh, at: 28))
        let payloadOffset = meta.localHeaderOffset + 30 + localNameLen + localExtraLen

        try handle.seek(toOffset: payloadOffset)
        let compressed = (try handle.read(upToCount: meta.compressedSize)) ?? Data()

        if meta.compressionMethod == 0 {
            return compressed
        }

        if meta.compressionMethod == 8 {
            if meta.uncompressedSize == 0 { return Data() }
            var output = Data(count: meta.uncompressedSize)
            let decodedCount: Int = output.withUnsafeMutableBytes { dstPtr in
                compressed.withUnsafeBytes { srcPtr in
                    guard let dstBase = dstPtr.bindMemory(to: UInt8.self).baseAddress,
                          let srcBase = srcPtr.bindMemory(to: UInt8.self).baseAddress
                    else { return 0 }
                    // COMPRESSION_ZLIB implements raw RFC 1951 DEFLATE
                    return compression_decode_buffer(
                        dstBase,
                        meta.uncompressedSize,
                        srcBase,
                        compressed.count,
                        nil,
                        COMPRESSION_ZLIB
                    )
                }
            }
            guard decodedCount > 0 else {
                throw ZipFileError.decompressionFailed(path)
            }
            return output.prefix(decodedCount)
        }

        throw ZipFileError.unsupportedCompression(meta.compressionMethod)
    }
}

private func readUInt16LE(_ data: Data, at offset: Int) -> UInt16 {
    let i = data.startIndex + offset
    return UInt16(data[i]) | (UInt16(data[i + 1]) << 8)
}

private func readUInt32LE(_ data: Data, at offset: Int) -> UInt32 {
    let i = data.startIndex + offset
    return UInt32(data[i])
        | (UInt32(data[i + 1]) << 8)
        | (UInt32(data[i + 2]) << 16)
        | (UInt32(data[i + 3]) << 24)
}

private func readUInt64LE(_ data: Data, at offset: Int) -> UInt64 {
    let low = UInt64(readUInt32LE(data, at: offset))
    let high = UInt64(readUInt32LE(data, at: offset + 4))
    return low | (high << 32)
}
