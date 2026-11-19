import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { AndroidParser, ConvertChat, IosParser, ParserRegistry } from "@whatsappya/core";
import { FolderBundleExporter, StandaloneHtmlExporter } from "@whatsappya/exporter";
import { DirectoryFileSource } from "@whatsappya/platform-node";
import { STANDALONE_VIEWER_CSS, STANDALONE_VIEWER_JS } from "@whatsappya/viewer/standalone";

export interface ConvertOptions {
  readonly input: string;
  readonly output: string;
  readonly you: string | undefined;
  readonly dist?: string | undefined;
  readonly standalone?: boolean | undefined;
  readonly legacyVoiceCache?: boolean | undefined;
}

const IGNORED_NAMES = new Set([".ds_store", "__pycache__", "thumbs.db"]);

const EXPORT_ASSETS = {
  viewerJs: STANDALONE_VIEWER_JS,
  viewerCss: STANDALONE_VIEWER_CSS,
};

async function copyMediaAssets(sourceDir: string, destDir: string): Promise<void> {
  if (resolve(sourceDir) === resolve(destDir)) return;
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_NAMES.has(entry.name.toLowerCase())) continue;
    const srcPath = join(sourceDir, entry.name);
    const dstPath = join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyMediaAssets(srcPath, dstPath);
    } else if (entry.isFile()) {
      const srcStat = await stat(srcPath);
      try {
        const dstStat = await stat(dstPath);
        if (dstStat.size === srcStat.size) continue;
      } catch {
        // Destination does not exist yet
      }
      await copyFile(srcPath, dstPath);
    }
  }
}

export async function convertCommand(opts: ConvertOptions): Promise<number> {
  const inputPath = resolve(opts.input);
  const files = new DirectoryFileSource(inputPath);
  const useCase = new ConvertChat({
    parsers: new ParserRegistry().register(new IosParser()).register(new AndroidParser()),
  });

  const result = await useCase.execute({
    files,
    ...(opts.you ? { ownerName: opts.you } : {}),
  });
  if (!result.ok) {
    console.error(`✗ ${result.error.code}`);
    return 1;
  }

  const session = result.value;

  if (opts.standalone) {
    const exporter = new StandaloneHtmlExporter(EXPORT_ASSETS);
    const html = exporter.build(session);
    const outPath = resolve(
      opts.dist ? join(opts.dist, opts.output) : join(inputPath, opts.output),
    );
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, html, "utf8");
    console.log(`✓ Exported ${session.messages.length} messages → ${outPath}`);
    return 0;
  }

  const folderName = basename(inputPath);
  const targetRoot = resolve(opts.dist ?? dirname(inputPath));
  const destFolder = join(targetRoot, folderName);

  // Copy source media assets into the dist bundle folder so relative links resolve offline
  if (opts.dist) {
    await copyMediaAssets(inputPath, destFolder);
  }

  const bundleExporter = new FolderBundleExporter(EXPORT_ASSETS);
  const bundleFiles = await bundleExporter.build(session, files, {
    folderName,
    htmlFilename: opts.output,
    createLauncher: true,
    createIndex: Boolean(opts.dist),
    legacyVoiceCache: opts.legacyVoiceCache,
  });

  for (const file of bundleFiles) {
    const dest = join(targetRoot, file.relativePath);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, file.content);
  }

  console.log(
    `✓ Exported ${session.messages.length} messages (${bundleFiles.length} files) → ${join(destFolder, opts.output)}`,
  );
  return 0;
}
