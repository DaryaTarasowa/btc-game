/**
 * Bootstraps the AWS IAM permissions required to deploy the BTC game.
 *
 * Run this script using an AWS administrator identity when the application's
 * deployment permissions or runtime permissions boundary change.
 *
 * The script:
 * - renders the IAM policy templates for the current AWS account and region;
 * - creates or updates the `btc-game-developer` managed policy;
 * - creates or updates the `btc-game-runtime-boundary` managed policy;
 * - attaches the deployment policy to the `btc-game-developer` IAM user;
 * - manages IAM policy versions automatically.
 *
 * This script does not deploy application infrastructure. After bootstrap,
 * switch to the `btc-game-developer` identity and use Terraform/deployment
 * tooling normally.
 *
 * Example:
 *
 *   AWS_PROFILE=root node scripts/bootstrap-aws.mjs
 *
 * Then:
 *
 *   export AWS_PROFILE=btc-game-developer
 *   terraform ...
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_IAM_USER = "btc-game-developer";
const DEFAULT_REGION = "eu-central-1";
const BOUNDARY_POLICY_NAME = "btc-game-runtime-boundary";
const DEPLOYER_POLICY_NAME = "btc-game-developer";
const MAX_MANAGED_POLICY_CHARACTERS = 6_144;

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const bootstrapDirectory = join(repositoryRoot, "terraform", "bootstrap");

try {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    printUsage();
  } else {
    await bootstrap(options);
  }
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Unknown bootstrap error.";
  console.error(`AWS bootstrap failed: ${message}`);
  process.exitCode = 1;
}

async function bootstrap({ iamUser, region }) {
  const identity = runAwsJson(["sts", "get-caller-identity"]);
  const accountId = requireString(identity.Account, "STS account ID");
  const identityArn = requireString(identity.Arn, "STS identity ARN");
  const partition = identityArn.split(":")[1];

  if (!partition || !/^[a-z0-9-]+$/.test(partition)) {
    throw new Error(
      `Could not determine the AWS partition from the active identity.`,
    );
  }

  const boundaryPolicyArn = `arn:${partition}:iam::${accountId}:policy/${BOUNDARY_POLICY_NAME}`;
  const deployerPolicyArn = `arn:${partition}:iam::${accountId}:policy/${DEPLOYER_POLICY_NAME}`;

  console.log("AWS administrator bootstrap target:");
  console.log(`  Account: ${accountId}`);
  console.log(`  Active identity: ${identityArn}`);
  console.log(`  Region: ${region}`);
  console.log(`  Deployment user: ${iamUser}`);
  console.log(`  Runtime boundary: ${boundaryPolicyArn}`);
  console.log(`  Deployment policy: ${deployerPolicyArn}`);

  console.log(`Verifying deployment IAM user ${iamUser}...`);
  runAwsJson(["iam", "get-user", "--user-name", iamUser]);

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "btc-game-bootstrap-"),
  );

  try {
    const replacements = {
      "${AWS_PARTITION}": partition,
      "${AWS_REGION}": region,
      "${AWS_ACCOUNT_ID}": accountId,
    };
    const renderedBoundaryPath = await renderPolicy(
      join(
        bootstrapDirectory,
        "btc-game-runtime-boundary-policy.template.json",
      ),
      join(temporaryDirectory, "btc-game-runtime-boundary-policy.json"),
      replacements,
    );
    const renderedDeployerPath = await renderPolicy(
      join(bootstrapDirectory, "btc-game-developer-policy.template.json"),
      join(temporaryDirectory, "btc-game-developer-policy.json"),
      replacements,
    );

    await createOrUpdatePolicy({
      name: BOUNDARY_POLICY_NAME,
      arn: boundaryPolicyArn,
      documentPath: renderedBoundaryPath,
      description: "Maximum permissions for BTC game runtime roles.",
    });
    await createOrUpdatePolicy({
      name: DEPLOYER_POLICY_NAME,
      arn: deployerPolicyArn,
      documentPath: renderedDeployerPath,
      description: "Terraform deployment permissions for the BTC game.",
    });

    console.log(`Attaching ${DEPLOYER_POLICY_NAME} to ${iamUser}...`);
    runAws([
      "iam",
      "attach-user-policy",
      "--user-name",
      iamUser,
      "--policy-arn",
      deployerPolicyArn,
    ]);

    console.log("AWS bootstrap completed successfully.");
    console.log(
      `Next: authenticate as ${iamUser}, then run Terraform from the terraform directory.`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function renderPolicy(templatePath, outputPath, replacements) {
  let rendered = await readFile(templatePath, "utf8");
  for (const [placeholder, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(placeholder, value);
  }

  const unresolved = rendered.match(/\$\{AWS_[A-Z_]+\}/g);
  if (unresolved) {
    throw new Error(
      `Unresolved template values in ${templatePath}: ${unresolved.join(", ")}`,
    );
  }

  let policy;
  try {
    policy = JSON.parse(rendered);
  } catch (error) {
    throw new Error(
      `Rendered policy is invalid JSON (${templatePath}): ${error.message}`,
    );
  }

  const compactPolicy = JSON.stringify(policy);
  if (compactPolicy.length > MAX_MANAGED_POLICY_CHARACTERS) {
    throw new Error(
      `Rendered policy exceeds the IAM managed-policy limit (${compactPolicy.length}/${MAX_MANAGED_POLICY_CHARACTERS} characters): ${templatePath}`,
    );
  }

  await writeFile(outputPath, compactPolicy, { encoding: "utf8", mode: 0o600 });
  return outputPath;
}

async function createOrUpdatePolicy({ name, arn, documentPath, description }) {
  const existing = tryRunAwsJson(["iam", "get-policy", "--policy-arn", arn]);

  if (!existing.found) {
    if (existing.errorCode !== "NoSuchEntity") {
      throw new Error(existing.message);
    }

    console.log(`Creating ${name}...`);
    runAws([
      "iam",
      "create-policy",
      "--policy-name",
      name,
      "--description",
      description,
      "--policy-document",
      policyFileArgument(documentPath),
    ]);
    return;
  }

  console.log(`Updating ${name}...`);
  const versionsResponse = runAwsJson([
    "iam",
    "list-policy-versions",
    "--policy-arn",
    arn,
  ]);
  const versions = Array.isArray(versionsResponse.Versions)
    ? versionsResponse.Versions
    : [];

  if (versions.length >= 5) {
    const oldestNonDefault = versions
      .filter((version) => version.IsDefaultVersion !== true)
      .sort((left, right) =>
        String(left.CreateDate).localeCompare(String(right.CreateDate)),
      )[0];

    if (!oldestNonDefault || typeof oldestNonDefault.VersionId !== "string") {
      throw new Error(`Cannot free a policy-version slot for ${name}.`);
    }

    console.log(
      `Deleting oldest non-default version ${oldestNonDefault.VersionId} of ${name}...`,
    );
    runAws([
      "iam",
      "delete-policy-version",
      "--policy-arn",
      arn,
      "--version-id",
      oldestNonDefault.VersionId,
    ]);
  }

  runAws([
    "iam",
    "create-policy-version",
    "--policy-arn",
    arn,
    "--policy-document",
    policyFileArgument(documentPath),
    "--set-as-default",
  ]);
}

function tryRunAwsJson(arguments_) {
  const result = executeAws([...arguments_, "--output", "json"]);
  if (result.status === 0) {
    return { found: true, value: parseAwsJson(result.stdout, arguments_) };
  }

  const errorCode = extractAwsErrorCode(result.stderr);
  return {
    found: false,
    errorCode,
    message: formatAwsFailure(arguments_, result),
  };
}

function runAwsJson(arguments_) {
  const output = runAws([...arguments_, "--output", "json"]);
  return parseAwsJson(output, arguments_);
}

function runAws(arguments_) {
  const result = executeAws(arguments_);
  if (result.status !== 0) {
    throw new Error(formatAwsFailure(arguments_, result));
  }
  return result.stdout;
}

function executeAws(arguments_) {
  const executable = process.platform === "win32" ? "aws.exe" : "aws";
  const result = spawnSync(executable, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new Error(`Could not run AWS CLI: ${result.error.message}`);
  }

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseAwsJson(output, arguments_) {
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(
      `AWS CLI returned invalid JSON for aws ${arguments_.join(" ")}: ${error.message}`,
    );
  }
}

function extractAwsErrorCode(stderr) {
  return stderr.match(/\(([^)]+)\) when calling/)?.[1] ?? null;
}

function formatAwsFailure(arguments_, result) {
  const detail =
    result.stderr.trim() || `exit code ${result.status ?? "unknown"}`;
  return `aws ${arguments_.join(" ")} failed: ${detail}`;
}

function policyFileArgument(path) {
  return `file://${path}`;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`AWS CLI returned an invalid ${label}.`);
  }
  return value;
}

function parseArguments(arguments_) {
  const options = {
    help: false,
    iamUser: DEFAULT_IAM_USER,
    region: DEFAULT_REGION,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }
    if (argument !== "--iam-user" && argument !== "--region") {
      throw new Error(`Unknown argument: ${argument}`);
    }

    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    if (argument === "--iam-user") {
      options.iamUser = value;
    } else {
      options.region = value;
    }
    index += 1;
  }

  if (!/^[\w+=,.@-]{1,64}$/.test(options.iamUser)) {
    throw new Error("The IAM user name is invalid.");
  }
  if (!/^[a-z0-9-]+-\d$/.test(options.region)) {
    throw new Error("The AWS region is invalid.");
  }

  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/bootstrap-aws.mjs [options]

Options:
  --iam-user <name>  Deployment IAM user (default: ${DEFAULT_IAM_USER})
  --region <region>  AWS region (default: ${DEFAULT_REGION})
  -h, --help         Show this help`);
}
