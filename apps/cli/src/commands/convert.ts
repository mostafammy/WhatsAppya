import { AndroidParser, ConvertChat, IosParser, ParserRegistry } from "@whatsappya/core";
import { DirectoryFileSource } from "@whatsappya/platform-node";

export interface ConvertOptions {
  readonly input: string;
  readonly output: string;
  readonly you: string | undefined;
}

export async function convertCommand(opts: ConvertOptions): Promise<number> {
  const useCase = new ConvertChat({
    parsers: new ParserRegistry().register(new IosParser()).register(new AndroidParser()),
    stages: [],
  });
  const result = await useCase.execute({
    files: new DirectoryFileSource(opts.input),
    ...(opts.you ? { ownerName: opts.you } : {}),
  });
  if (!result.ok) {
    console.error(`✗ ${result.error.code}`);
    return 1;
  }
  console.log(
    `✓ Parsed ${result.value.messages.length} messages → ${opts.output} (exporter wiring TODO)`,
  );
  return 0;
}
