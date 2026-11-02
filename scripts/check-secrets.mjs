import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const unique = [...new Set(files)];
const signatures = [
  /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{35,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const findings = [];
for (const file of unique) {
  if (/(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".env.example"))
    findings.push(`${file}: environment file in commit candidate`);
  if (file.startsWith("application/"))
    findings.push(`${file}: private application material in commit candidate`);
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (signatures.some((pattern) => pattern.test(line)))
      findings.push(`${file}:${i + 1}: possible credential (value redacted)`);
  });
}
if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Reviewed ${unique.length} commit-candidate files: no matching credentials or private application files. This targeted scan is not a guarantee; inspect the diff before pushing.`,
  );
