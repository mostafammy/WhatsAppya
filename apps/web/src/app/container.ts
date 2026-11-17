import { AndroidParser, ConvertChat, IosParser, ParserRegistry } from "@whatsappya/core";

/** Dependency-injection container (manual DI — no framework needed at this size). */
export const createConvertChat = (): ConvertChat =>
  new ConvertChat({
    parsers: new ParserRegistry().register(new IosParser()).register(new AndroidParser()),
    stages: [],
  });
