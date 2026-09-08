export {};

declare global {
  interface Window {
    __TURNITHUMAN_TEST_MODEL__?: boolean;
  }

  interface Document {
    readonly modelContext?: {
      registerTool: (
        tool: {
          name: string;
          title?: string;
          description: string;
          inputSchema: object;
          annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
          execute: (input: unknown) => Promise<unknown> | Record<string, unknown>;
        },
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}
