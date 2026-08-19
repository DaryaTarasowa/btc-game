/**
 * Prepares and deploys normal price-consumer releases.
 *
 * Terraform owns the long-lived ECS/ECR infrastructure. This script assumes
 * the ECS service already exists with a current task definition. It builds and
 * pushes an immutable Git-SHA image, clones the current task definition with
 * only the consumer image changed, registers the next revision, and rolls the
 * service to that revision. First-environment setup is documented in README.md.
 *
 * Prepare: node scripts/deploy-price-consumer.mjs
 * Deploy:  node scripts/deploy-price-consumer.mjs --apply
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const terraformDirectory = join(repositoryRoot, "terraform");
const consumerDirectory = join(repositoryRoot, "backend", "price-consumer");
const releasePath = join(repositoryRoot, "work", "price-consumer-release.json");

if (shouldApply(process.argv.slice(2))) {
  applyRelease();
} else {
  prepareRelease();
}

function prepareRelease() {
  if (run("git", ["status", "--porcelain"], { capture: true }).trim()) {
    throw new Error(
      "Commit or stash repository changes before building an immutable deployment image.",
    );
  }

  const imageTag = run("git", ["rev-parse", "HEAD"], {
    capture: true,
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(imageTag)) {
    throw new Error(
      "Could not determine a full Git commit SHA for the image tag.",
    );
  }

  const repositoryUrl = terraformOutput("price_consumer_ecr_repository_url");
  const localImage = `btc-game-price-consumer:${imageTag}`;
  console.log(`Building ${localImage}...`);
  run("docker", ["build", "--tag", localImage, consumerDirectory]);

  writeFileSync(
    releasePath,
    `${JSON.stringify({ imageTag, repositoryUrl }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Saved release metadata to ${releasePath}`);
  console.log(
    "Review it, then run: node scripts/deploy-price-consumer.mjs --apply",
  );
}

function applyRelease() {
  if (!existsSync(releasePath)) {
    throw new Error(
      `Release metadata not found: ${releasePath}. Prepare the release first.`,
    );
  }

  const release = JSON.parse(readFileSync(releasePath, "utf8"));
  if (
    typeof release.imageTag !== "string" ||
    !/^[0-9a-f]{40}$/.test(release.imageTag) ||
    typeof release.repositoryUrl !== "string" ||
    !release.repositoryUrl
  ) {
    throw new Error(`Release metadata is invalid: ${releasePath}`);
  }

  const localImage = `btc-game-price-consumer:${release.imageTag}`;
  const remoteImage = `${release.repositoryUrl}:${release.imageTag}`;
  const registry = release.repositoryUrl.split("/")[0];
  const cluster = terraformOutput("price_consumer_ecs_cluster_name");
  const service = terraformOutput("price_consumer_ecs_service_name");
  const liveEndpoint = terraformOutput("live_price_event_http_endpoint");

  const password = run("aws", ["ecr", "get-login-password"], { capture: true });
  run("docker", ["login", "--username", "AWS", "--password-stdin", registry], {
    input: password,
  });
  run("docker", ["tag", localImage, remoteImage]);
  run("docker", ["push", remoteImage]);

  const currentTaskDefinition = run(
    "aws",
    [
      "ecs",
      "describe-services",
      "--cluster",
      cluster,
      "--services",
      service,
      "--query",
      "services[0].taskDefinition",
      "--output",
      "text",
      "--no-cli-pager",
    ],
    { capture: true },
  ).trim();
  if (!currentTaskDefinition || currentTaskDefinition === "None") {
    throw new Error(`ECS service ${service} has no current task definition.`);
  }

  const described = JSON.parse(
    run(
      "aws",
      [
        "ecs",
        "describe-task-definition",
        "--task-definition",
        currentTaskDefinition,
        "--query",
        "taskDefinition",
        "--output",
        "json",
        "--no-cli-pager",
      ],
      { capture: true },
    ),
  );
  const registration = registrationForRelease(
    described,
    remoteImage,
    liveEndpoint,
  );
  const taskDefinition = run(
    "aws",
    [
      "ecs",
      "register-task-definition",
      "--cli-input-json",
      JSON.stringify(registration),
      "--query",
      "taskDefinition.taskDefinitionArn",
      "--output",
      "text",
      "--no-cli-pager",
    ],
    { capture: true },
  ).trim();

  console.log(`Updating ${service}...`);
  run(
    "aws",
    [
      "ecs",
      "update-service",
      "--cluster",
      cluster,
      "--service",
      service,
      "--task-definition",
      taskDefinition,
      "--desired-count",
      "1",
      "--no-cli-pager",
    ],
    { quiet: true },
  );

  console.log(`Waiting for ${service} deployment to be running...`);
  waitUntilRunning(cluster, service, taskDefinition);
  console.log(`Deployed price-consumer image ${remoteImage}.`);
}

function setEnvironmentVariable(environment = [], name, value) {
  const withoutExisting = environment.filter(
    (variable) => variable.name !== name,
  );

  return [...withoutExisting, { name, value }];
}

function registrationForRelease(taskDefinition, image, liveEndpoint) {
  const {
    taskDefinitionArn: _arn,
    revision: _revision,
    status: _status,
    requiresAttributes: _attributes,
    compatibilities: _compatibilities,
    registeredAt: _registeredAt,
    registeredBy: _registeredBy,
    deregisteredAt: _deregisteredAt,
    ...registration
  } = taskDefinition;

  let replaced = false;
  registration.containerDefinitions = registration.containerDefinitions.map(
    (container) => {
      if (container.name !== "price-consumer") return container;
      replaced = true;
      return {
        ...container,
        image,
        environment: setEnvironmentVariable(
          container.environment,
          "APPSYNC_EVENTS_ENDPOINT",
          liveEndpoint,
        ),
      };
    },
  );
  if (!replaced) {
    throw new Error(
      'Current task definition has no "price-consumer" container.',
    );
  }
  return registration;
}

// The generic services-stable waiter can be delayed by old zero-task
// deployments, so check only the service and its new PRIMARY deployment.
function waitUntilRunning(cluster, service, taskDefinition) {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const status = JSON.parse(
      run(
        "aws",
        [
          "ecs",
          "describe-services",
          "--cluster",
          cluster,
          "--services",
          service,
          "--query",
          "services[0].{desired:desiredCount,running:runningCount,pending:pendingCount,primary:deployments[?status=='PRIMARY']|[0]}",
          "--output",
          "json",
          "--no-cli-pager",
        ],
        { capture: true },
      ),
    );
    const primary = status?.primary;
    if (
      status?.desired === 1 &&
      status.running === 1 &&
      status.pending === 0 &&
      primary?.taskDefinition === taskDefinition &&
      primary.desiredCount === 1 &&
      primary.runningCount === 1 &&
      primary.pendingCount === 0
    ) {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5_000);
  }
  throw new Error(`ECS deployment did not start within 5 minutes.`);
}

function terraformOutput(name) {
  return run(
    "terraform",
    [`-chdir=${terraformDirectory}`, "output", "-raw", name],
    { capture: true },
  ).trim();
}

function shouldApply(arguments_) {
  if (arguments_.length === 0) return false;
  if (arguments_.length === 1 && arguments_[0] === "--apply") return true;
  throw new Error(`Usage: node scripts/deploy-price-consumer.mjs [--apply]`);
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    input: options.input,
    stdio: options.capture
      ? [options.input === undefined ? "inherit" : "pipe", "pipe", "inherit"]
      : options.quiet
        ? ["inherit", "ignore", "inherit"]
        : options.input === undefined
          ? "inherit"
          : ["pipe", "inherit", "inherit"],
  });
  if (result.error)
    throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `${command} failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
  return result.stdout ?? "";
}
