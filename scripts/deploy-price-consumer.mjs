import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const terraformDirectory = join(repositoryRoot, "terraform");
const consumerDirectory = join(repositoryRoot, "backend", "price-consumer");
const planPath = join(terraformDirectory, "price-consumer-deployment.tfplan");
const apply = parseArguments(process.argv.slice(2));

const dirtyFiles = run("git", ["status", "--porcelain"], { captureOutput: true }).trim();
if (dirtyFiles) {
  throw new Error("Commit or stash repository changes before building an immutable deployment image.");
}

const imageTag = run("git", ["rev-parse", "HEAD"], { captureOutput: true }).trim();
if (!/^[0-9a-f]{40}$/.test(imageTag)) {
  throw new Error("Could not determine a full Git commit SHA for the image tag.");
}

const repositoryUrl = terraformOutput("price_consumer_ecr_repository_url");
const localImage = `btc-game-price-consumer:${imageTag}`;
const remoteImage = `${repositoryUrl}:${imageTag}`;

console.log(`Building ${localImage} from ${consumerDirectory}`);
run("docker", ["build", "--tag", localImage, consumerDirectory]);

if (!apply) {
  run("terraform", [
    `-chdir=${terraformDirectory}`,
    "plan",
    `-var=price_consumer_image_tag=${imageTag}`,
    `-out=${planPath}`,
  ]);
  console.log(`Saved deployment plan to ${planPath}`);
  console.log("Review it, then run: node scripts/deploy-price-consumer.mjs --apply");
  process.exit(0);
}

if (!existsSync(planPath)) {
  throw new Error(`Deployment plan not found: ${planPath}. Run the script without --apply first.`);
}

const registry = repositoryUrl.split("/")[0];
if (!registry) {
  throw new Error(`Terraform returned an invalid ECR repository URL: ${repositoryUrl}`);
}

const password = run("aws", ["ecr", "get-login-password"], { captureOutput: true });
run("docker", ["login", "--username", "AWS", "--password-stdin", registry], {
  input: password,
});
run("docker", ["tag", localImage, remoteImage]);
run("docker", ["push", remoteImage]);
run("terraform", [`-chdir=${terraformDirectory}`, "apply", planPath]);

console.log(`Deployed price-consumer image ${remoteImage}.`);

function terraformOutput(name) {
  return run(
    "terraform",
    [`-chdir=${terraformDirectory}`, "output", "-raw", name],
    { captureOutput: true },
  ).trim();
}

function parseArguments(arguments_) {
  const supported = new Set(["--apply"]);
  const unknown = arguments_.filter((argument) => !supported.has(argument));
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  }
  return arguments_.includes("--apply");
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd ?? repositoryRoot,
    encoding: "utf8",
    input: options.input,
    stdio: options.captureOutput
      ? [options.input === undefined ? "inherit" : "pipe", "pipe", "inherit"]
      : options.input === undefined
        ? "inherit"
        : ["pipe", "inherit", "inherit"],
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? "unknown"}.`);
  }
  return result.stdout ?? "";
}
