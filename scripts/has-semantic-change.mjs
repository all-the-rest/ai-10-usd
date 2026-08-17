// Exit 0 = semantic change in public/data/latest.json (commit), 1 = none (skip).
// Ignores the volatile generatedAt stamp so timestamp-only diffs never create a commit loop.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const strip = (json) => {
  const obj = JSON.parse(json);
  delete obj.generatedAt;
  return JSON.stringify(obj);
};

const head = execSync("git show HEAD:public/data/latest.json", { encoding: "utf8" });
const current = readFileSync("public/data/latest.json", "utf8");

process.exit(strip(current) === strip(head) ? 1 : 0);
