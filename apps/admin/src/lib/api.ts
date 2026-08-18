import { createApi } from "@hull/api-client";

// No `errMsg` re-export any more. What a person reads goes through `useErrMsg`
// from `@hull/ui`, which resolves the server's `message_key` in the reader's own
// language; the English one is still exported from `@hull/api-client` for the
// places where English is correct. → ADR-0016
export const api = createApi({ prefix: "/api" });
