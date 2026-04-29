import { main } from "../cli/index.js";

export async function runAction(
  environment: NodeJS.ProcessEnv = process.env,
  runCli: (argv: string[]) => Promise<number> = main,
): Promise<void> {
  const command = environment.INPUT_COMMAND;
  if (!command) {
    throw new Error("missing action input: command");
  }

  const argv = [command, ..._buildActionArgs(environment, command)];
  const exitCode = await runCli(argv);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

function _buildActionArgs(environment: NodeJS.ProcessEnv, command: string): string[] {
  const args: string[] = [];
  _pushOption(args, "--db", _resolveDbPath(environment, command));
  _pushOption(args, "--owner", environment.INPUT_OWNER);
  _pushOption(args, "--package", environment.INPUT_PACKAGE);
  _pushOption(args, "--token", environment.INPUT_TOKEN);
  _pushOption(args, "--older-than-days", environment.INPUT_OLDER_THAN_DAYS);

  if (environment.INPUT_DELETE_UNTAGGED === "true") {
    args.push("--delete-untagged");
  }

  for (const tag of _parseExcludeTags(environment.INPUT_EXCLUDE_TAGS)) {
    args.push("--exclude-tag", tag);
  }

  return args;
}

function _resolveDbPath(environment: NodeJS.ProcessEnv, command: string): string | undefined {
  if (command !== "scan") {
    return undefined;
  }

  const owner = environment.INPUT_OWNER;
  const packageName = environment.INPUT_PACKAGE;
  if (!owner || !packageName) {
    return undefined;
  }

  const runnerTemp = environment.RUNNER_TEMP ?? "/tmp";
  const safeOwner = _sanitizeSegment(owner);
  const safePackageName = _sanitizeSegment(packageName);
  return `${runnerTemp}/ghcr-manager/${safeOwner}__${safePackageName}.sqlite`;
}

function _sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function _pushOption(args: string[], name: string, value: string | undefined): void {
  if (value) {
    args.push(name, value);
  }
}

function _parseExcludeTags(rawValue: string | undefined): string[] {
  return (rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
