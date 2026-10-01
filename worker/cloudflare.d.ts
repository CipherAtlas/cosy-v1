declare module "cloudflare:workers" {
  export class DurableObject {
    protected ctx: import("./runtime").WorkerState;
    protected env: import("./runtime").WorkerEnvironment;
    constructor(ctx: import("./runtime").WorkerState, env: import("./runtime").WorkerEnvironment);
  }
}
