import "server-only";
import path from "path";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid numeric env ${name}`);
  return Math.floor(n);
}

function str(name: string, fallback = ""): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Centralized, typed server configuration. Never import from client components. */
export const env = {
  get anthropicModel() {
    return str("ANTHROPIC_MODEL", "claude-opus-5-5");
  },
  get anthropicEffort(): Effort {
    const e = str("ANTHROPIC_EFFORT", "high");
    return (["low", "medium", "high", "xhigh", "max"].includes(e) ? e : "high") as Effort;
  },
  get aiMaxOutputTokens() {
    return int("AI_MAX_OUTPUT_TOKENS", 64000);
  },
  get aiMaxAgentSteps() {
    return int("AI_MAX_AGENT_STEPS", 40);
  },
  get aiMaxRepairAttempts() {
    return int("AI_MAX_REPAIR_ATTEMPTS", 3);
  },
  get maxPromptChars() {
    return int("MAX_PROMPT_CHARS", 8000);
  },
  get domain() {
    return str("PRISMATIC_DOMAIN", "prismatic.com").toLowerCase();
  },
  get caddyAskSecret() {
    return str("CADDY_ASK_SECRET");
  },
  get deploymentMode(): "local" | "production" {
    return str("DEPLOYMENT_MODE", "local") === "production" ? "production" : "local";
  },
  get dockerHost() {
    return str("DOCKER_HOST");
  },
  get runtimeImage() {
    return str("RUNTIME_IMAGE", "prismatic-runtime:latest");
  },
  get projectNetwork() {
    return str("PROJECT_NETWORK", "prismatic_projects");
  },
  get containerMemoryMb() {
    return int("CONTAINER_MEMORY_MB", 512);
  },
  get containerCpus() {
    return Number(str("CONTAINER_CPUS", "1")) || 1;
  },
  get containerPidsLimit() {
    return int("CONTAINER_PIDS_LIMIT", 256);
  },
  get buildTimeoutSeconds() {
    return int("BUILD_TIMEOUT_SECONDS", 180);
  },
  get storagePath() {
    return path.resolve(str("STORAGE_PATH", path.join(process.cwd(), "storage")));
  },
  get redisUrl() {
    return str("REDIS_URL");
  },
  get robinhoodRpcUrl() {
    return str("ROBINHOOD_RPC_URL", "https://rpc.mainnet.chain.robinhood.com");
  },

  /* Aestrodom Pass (lib/nft) and sponsored launches (lib/pons/sponsor). */
  /** AestrodomPass ERC-721 on Robinhood Chain (default: the live contract). */
  get passContract() {
    return str("PASS_CONTRACT_ADDRESS", "0xeaa60c3abe6259042ff099c4200cb2c1b0db46f0");
  },
  /**
   * Hot wallet that pays launch fee + gas for free launches. Keep only a small balance in it.
   * Read only by lib/pons/sponsor.ts and scripts/deploy-pass.mjs; never logged or returned.
   */
  get sponsorPrivateKey() {
    return str("SPONSOR_PRIVATE_KEY");
  },
  /** Most free launches the sponsor wallet pays for per UTC day across all passes (cost guard). */
  get freeLaunchDailyCap() {
    return int("FREE_LAUNCH_DAILY_CAP", 500);
  },

  /* Credits & API keys (lib/billing). Top-ups are in USD, paid in $AESTRODOM at the live curve price. */
  get creditsTreasury() {
    return str("CREDITS_TREASURY_ADDRESS", "0x13d471c30f28081fac917a2112478548978eff86");
  },
  get creditsToken() {
    return str("CREDITS_TOKEN_ADDRESS", "0x72c11afca4c6a30e01fadce6526cc35d857f4f20");
  },
  /** Credits per US dollar topped up. 0 turns buying off. */
  get creditsPerUsd() {
    return int("CREDITS_PER_USD", 100);
  },
  /** Preset top-up amounts in USD shown as buttons. */
  get topupOptions() {
    const opts = str("CREDIT_TOPUP_OPTIONS", "1,5,10,25")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v > 0);
    return opts.length ? opts : [1, 5, 10, 25];
  },
  get topupMinUsd() {
    return Number(str("CREDIT_TOPUP_MIN_USD", "1")) || 1;
  },
  get topupMaxUsd() {
    return Number(str("CREDIT_TOPUP_MAX_USD", "500")) || 500;
  },
  /**
   * Claude list prices in USD per million tokens, for the model in ANTHROPIC_MODEL (defaults: Claude Opus 5.5).
   * Cache writes are 5-minute ephemeral writes (1.25× input). Keep these in step with Anthropic's pricing page.
   */
  get claudePrice() {
    const p = (name: string, fallback: number) => {
      const v = Number(str(name, String(fallback)));
      return Number.isFinite(v) && v >= 0 ? v : fallback;
    };
    return {
      input: p("CLAUDE_PRICE_INPUT", 4),
      output: p("CLAUDE_PRICE_OUTPUT", 20),
      cacheRead: p("CLAUDE_PRICE_CACHE_READ", 0.2),
      cacheWrite: p("CLAUDE_PRICE_CACHE_WRITE", 5),
    };
  },
  /** Margin added on top of the Claude cost when charging credits, in percent. */
  /** Battleground voters must hold at least this much $AESTRODOM (in USD at the live price). 0 turns it off. */
  get voteMinHoldUsd() {
    const v = Number(str("VOTE_MIN_HOLD_USD", "1"));
    return Number.isFinite(v) && v >= 0 ? v : 1;
  },
  get creditMarginPercent() {
    const v = Number(str("CREDIT_MARGIN_PERCENT", "5"));
    return Number.isFinite(v) && v >= 0 ? v : 5;
  },
};
