import type {
  ArchiveFolder,
  ArchiveTree,
  ChatSummaryNode,
  ExportFormat,
} from "../domain/hierarchy.js";
import type { ParserRegistry } from "../parsers/ParserRegistry.js";
import type { FileSource } from "../ports/FileSource.js";
import { type Logger, silentLogger } from "../ports/Logger.js";
import { type Result, err, ok } from "../shared/result.js";
import { ConvertChat, type ConvertChatDeps } from "./ConvertChat.js";

export interface ConvertArchiveDeps {
  readonly parsers: ParserRegistry;
  readonly logger?: Logger | undefined;
}

export interface ConvertArchiveInput {
  readonly files: FileSource;
  readonly rootName?: string | undefined;
}

/**
 * USE CASE: Discovers multi-chat exports and recursive directory structures
 * (Curricular Mode / Multi-Chapter Archives).
 */
export class ConvertArchive {
  private readonly convertChat: ConvertChat;

  constructor(private readonly deps: ConvertArchiveDeps) {
    this.convertChat = new ConvertChat({
      parsers: deps.parsers,
      logger: deps.logger,
    });
  }

  async execute(input: ConvertArchiveInput): Promise<Result<ArchiveTree, Error>> {
    const log = this.deps.logger ?? silentLogger;
    try {
      const allFiles = await input.files.list();
      const chatFiles = allFiles.filter((f) => {
        const lower = f.path.toLowerCase();
        return lower.endsWith(".txt") && (lower.includes("chat") || lower.includes("whatsapp"));
      });

      if (chatFiles.length === 0) {
        // Fallback: any txt file
        const anyTxt = allFiles.filter((f) => f.path.toLowerCase().endsWith(".txt"));
        chatFiles.push(...anyTxt);
      }

      log.debug("archive.chat_files_found", { count: chatFiles.length });

      const chatNodes: Array<{ path: string; node: ChatSummaryNode }> = [];

      for (const file of chatFiles) {
        const chatRes = await this.convertChat.execute({
          files: input.files,
          chatPath: file.path,
        });

        if (chatRes.ok) {
          const session = chatRes.value;
          const firstMsg = session.messages[0];
          const lastMsg = session.messages[session.messages.length - 1];

          let exportFormat: ExportFormat = "unknown";
          const sampleText = await input.files.readText(file.path);
          const resolvedParser = this.deps.parsers.resolve(sampleText);
          if (resolvedParser?.id === "ios") exportFormat = "ios";
          else if (resolvedParser?.id === "android") exportFormat = "android";

          const summary: ChatSummaryNode = {
            id: `chat-${chatNodes.length}`,
            title: session.title,
            contactName: session.contactName,
            messageCount: session.messages.length,
            path: file.path,
            exportFormat,
            dateRange: {
              start: firstMsg?.timestamp ?? null,
              end: lastMsg?.timestamp ?? null,
            },
          };

          chatNodes.push({ path: file.path, node: summary });
        }
      }

      const rootFolder = this.#buildFolderHierarchy(input.rootName ?? "Archive", chatNodes);

      return ok({
        schemaVersion: 1,
        root: rootFolder,
      });
    } catch (cause) {
      return err(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }

  #buildFolderHierarchy(
    rootName: string,
    chatNodes: Array<{ path: string; node: ChatSummaryNode }>,
  ): ArchiveFolder {
    const root: ArchiveFolder = {
      id: "root",
      name: rootName,
      path: "",
      children: [],
      chats: [],
    };

    // If only one chat in root or single level
    if (chatNodes.length <= 1) {
      return {
        ...root,
        chats: chatNodes.map((c) => c.node),
      };
    }

    const folderMap = new Map<string, { folder: ArchiveFolder; parentPath: string }>();
    folderMap.set("", { folder: root, parentPath: "" });

    for (const item of chatNodes) {
      const normalized = item.path.replace(/\\/g, "/");
      const segments = normalized.split("/");
      segments.pop(); // remove filename

      const dirPath = segments.join("/");
      if (!dirPath) {
        (root.chats as ChatSummaryNode[]).push(item.node);
        continue;
      }

      let currentPath = "";
      for (const segment of segments) {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        if (!folderMap.has(currentPath)) {
          const newFolder: ArchiveFolder = {
            id: `folder-${currentPath}`,
            name: segment,
            path: currentPath,
            children: [],
            chats: [],
          };
          folderMap.set(currentPath, { folder: newFolder, parentPath });
          const parent = folderMap.get(parentPath)?.folder;
          if (parent) {
            (parent.children as ArchiveFolder[]).push(newFolder);
          }
        }
      }

      const leafFolder = folderMap.get(dirPath)?.folder;
      if (leafFolder) {
        (leafFolder.chats as ChatSummaryNode[]).push(item.node);
      }
    }

    return root;
  }
}
