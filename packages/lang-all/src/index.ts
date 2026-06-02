import type Parser from 'tree-sitter';
import { createRuntime as createTypeScriptRuntime } from '@alistar.max/coderecall-lang-typescript';
import { createRuntime as createKotlinRuntime } from '@alistar.max/coderecall-lang-kotlin';
import { createRuntime as createCSharpRuntime } from '@alistar.max/coderecall-lang-csharp';
import { createRuntime as createCppRuntime } from '@alistar.max/coderecall-lang-cpp';
import { createRuntime as createJavaRuntime } from '@alistar.max/coderecall-lang-java';
import { createRuntime as createRubyRuntime } from '@alistar.max/coderecall-lang-ruby';
import { createRuntime as createCRuntime } from '@alistar.max/coderecall-lang-c';
import { createRuntime as createPhpRuntime } from '@alistar.max/coderecall-lang-php';
import { createRuntime as createRustRuntime } from '@alistar.max/coderecall-lang-rust';
import { createRuntime as createSwiftRuntime } from '@alistar.max/coderecall-lang-swift';

export interface LanguageRuntime {
  id: string;
  languages: readonly string[];
  canParse(language: string): boolean;
  getParser(language: string): Promise<Parser | null>;
}

class AllRuntime implements LanguageRuntime {
  id = 'plugin-all';

  private readonly runtimes: LanguageRuntime[] = [
    createTypeScriptRuntime(),
    createKotlinRuntime(),
    createCSharpRuntime(),
    createCppRuntime(),
    createJavaRuntime(),
    createRubyRuntime(),
    createCRuntime(),
    createPhpRuntime(),
    createRustRuntime(),
    createSwiftRuntime(),
  ];

  readonly languages = Array.from(
    new Set(this.runtimes.flatMap((runtime) => runtime.languages)),
  );

  canParse(language: string): boolean {
    return this.runtimes.some((runtime) => runtime.canParse(language));
  }

  async getParser(language: string): Promise<Parser | null> {
    for (const runtime of this.runtimes) {
      if (!runtime.canParse(language)) continue;

      const parser = await runtime.getParser(language);
      if (parser) return parser;
    }

    return null;
  }
}

export function createRuntime(): LanguageRuntime {
  return new AllRuntime();
}
