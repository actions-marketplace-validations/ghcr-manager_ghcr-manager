import { main } from "../cli/index.js";

export async function runAction(
  environment: NodeJS.ProcessEnv = process.env,
  runCli: (argv: string[]) => Promise<number> = main,
): Promise<void> {
  const command = environment.INPUT_COMMAND;
  if (!command) {
    throw new Error("missing action input: command");
  }

  const argv = [command, ..._buildActionArgs(environment)];
  const exitCode = await runCli(argv);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

function _buildActionArgs(environment: NodeJS.ProcessEnv): string[] {
  const args: string[] = [];
  _pushOption(args, "--db", environment.INPUT_DB_PATH);
  _pushOption(args, "--snapshot", environment.INPUT_SNAPSHOT);
  _pushOption(args, "--source", environment.INPUT_SOURCE);
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
