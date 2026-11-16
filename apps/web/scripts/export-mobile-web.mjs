import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(webDir, "../..");
const dist = path.join(root, "apps/mobile/dist");
const target = path.join(webDir, "public/movil");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const env = { ...process.env, CI: "1", EXPO_WEB_OUTPUT: "single", EXPO_BASE_URL: "/movil" };
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (supabaseUrl) env.EXPO_PUBLIC_SUPABASE_URL = supabaseUrl;
if (supabaseKey) env.EXPO_PUBLIC_SUPABASE_ANON_KEY = supabaseKey;
const result = spawnSync(
  npm,
  ["exec", "--workspace", "@energym/mobile", "--", "expo", "export", "--platform", "web", "--output-dir", "dist"],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  },
);
if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) process.exit(result.status ?? 1);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(dist, target, { recursive: true });
