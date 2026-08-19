import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const terraformDirectory = join(repositoryRoot, "terraform");
const consumerDirectory = join(repositoryRoot, "backend", "price-consumer");
const releasePath = join(repositoryRoot, "work", "price-consumer-release.json");
const options = parseArguments(process.argv.slice(2));

if (options.mode === "apply") {
  applyRelease({ updateService: true });
} else if (options.mode === "register-only") {
  applyRelease({
    updateService: false,
    baseTaskDefinition: options.baseTaskDefinition,
  });
} else {
  prepareRelease();
}

function prepareRelease() {
  const dirtyFiles = run("git", ["status", "--porcelain"], {
    captureOutput: true,
  }).trim();
  if (dirtyFiles) {
    throw new Error(
      "Commit or stash repository changes before building an immutable deployment image.",
    );
  }

  const imageTag = run("git", ["rev-parse", "HEAD"], {
    captureOutput: true,
  }).trim();
  if (!/^[0-9a-f]{40}$/.test(imageTag)) {
    throw new Error("Could not determine a full Git commit SHA for the image tag.");
  }

  const repositoryUrl = terraformOutput("price_consumer_ecr_repository_url");
  const localImage = `btc-game-price-consumer:${imageTag}`;
  console.log(`Building ${localImage} from ${consumerDirectory}`);
  run("docker", ["build", "--tag", localImage, consumerDirectory]);

  writeFileSync(
    releasePath,
    `${JSON.stringify({ imageTag, repositoryUrl }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Saved release metadata to ${releasePath}`);
  console.log("Review it, then run: node scripts/deploy-price-consumer.mjs --apply");
}

function applyRelease({ updateService, baseTaskDefinition }) {
  if (!existsSync(releasePath)) {
    throw new Error(
      `Release metadata not found: ${releasePath}. Run the script without --apply first.`,
    );
  }

  const release = JSON.parse(readFileSync(releasePath, "utf8"));
  if (
    typeof release.imageTag !== "string" ||
    !/^[0-9a-f]{40}$/.test(release.imageTag) ||
    typeof release.repositoryUrl !== "string" ||
    release.repositoryUrl.length === 0
  ) {
    throw new Error(`Release metadata is invalid: ${releasePath}`);
  }

  const localImage = `btc-game-price-consumer:${release.imageTag}`;
  const remoteImage = `${release.repositoryUrl}:${release.imageTag}`;
  const registry = release.repositoryUrl.split("/")[0];
  if (!registry) {
    throw new Error(`Invalid ECR repository URL: ${release.repositoryUrl}`);
  }

  const password = run("aws", ["ecr", "get-login-password"], {
    captureOutput: true,
  });
  run("docker", ["login", "--username", "AWS", "--password-stdin", registry], {
    input: password,
  });
  run("docker", ["tag", localImage, remoteImage]);
  run("docker", ["push", remoteImage]);

  const clusterName = terraformOutput("price_consumer_ecs_cluster_name");
  const serviceName = terraformOutput("price_consumer_ecs_service_name");
  const sourceTaskDefinition = updateService
    ? currentServiceTaskDefinition(clusterName, serviceName)
    : baseTaskDefinition;

  if (!sourceTaskDefinition) {
    throw new Error(
      "--register-only requires --base-task-definition=<task-definition ARN or family:revision>.",
    );
  }

  const describedTaskDefinition = JSON.parse(
    run(
      "aws",
      [
        "ecs",
        "describe-task-definition",
        "--task-definition",
        sourceTaskDefinition,
        "--query",
        "taskDefinition",
        "--output",
        "json",
      ],
      { captureOutput: true },
    ),
  );
  const registration = registrationFromDescription(
    describedTaskDefinition,
    remoteImage,
  );

  const taskDefinitionArn = run(
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
    ],
    { captureOutput: true },
  ).trim();

  if (!updateService) {
    console.log(`Registered initial task definition ${taskDefinitionArn}.`);
    console.log(
      `Create the service with: terraform -chdir=terraform apply -var=price_consumer_initial_task_definition_arn=${taskDefinitionArn}`,
    );
    return;
  }

  run("aws", [
    "ecs",
    "update-service",
    "--cluster",
    clusterName,
    "--service",
    serviceName,
    "--task-definition",
    taskDefinitionArn,
    "--desired-count",
    "1",
  ]);

  console.log(`Waiting for ${serviceName} to become stable...`);
  run("aws", [
    "ecs",
    "wait",
    "services-stable",
    "--cluster",
    clusterName,
    "--services",
    serviceName,
  ]);

  console.log(`Deployed price-consumer image ${remoteImage}.`);
}

function currentServiceTaskDefinition(clusterName, serviceName) {
  const taskDefinition = run(
    "aws",
    [
      "ecs",
      "describe-services",
      "--cluster",
      clusterName,
      "--services",
      serviceName,
      "--query",
      "services[0].taskDefinition",
      "--output",
      "text",
    ],
    { captureOutput: true },
  ).trim();

  if (!taskDefinition || taskDefinition === "None") {
    throw new Error(`ECS service ${serviceName} has no current task definition.`);
  }
  return taskDefinition;
}

function registrationFromDescription(taskDefinition, remoteImage) {
  const {
    taskDefinitionArn: _taskDefinitionArn,
    revision: _revision,
    status: _status,
    requiresAttributes: _requiresAttributes,
    compatibilities: _compatibilities,
    registeredAt: _registeredAt,
    registeredBy: _registeredBy,
    deregisteredAt: _deregisteredAt,
    ...registration
  } = taskDefinition;

  let imageUpdated = false;
  registration.containerDefinitions = registration.containerDefinitions.map(
    (container) => {
      if (container.name !== "price-consumer") return container;
      imageUpdated = true;
      return { ...container, image: remoteImage };
    },
  );

  if (!imageUpdated) {
    throw new Error(
      'The base task definition does not contain a container named "price-consumer".',
    );
  }
  return registration;
}

function terraformOutput(name) {
  return run(
    "terraform",
    [`-chdir=${terraformDirectory}`, "output", "-raw", name],
    { captureOutput: true },
  ).trim();
}

function parseArguments(arguments_) {
  const baseArgument = arguments_.find((argument) =>
    argument.startsWith("--base-task-definition="),
  );
  const supported = new Set(["--apply", "--register-only", baseArgument]);
  const unknown = arguments_.filter((argument) => !supported.has(argument));
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  if (arguments_.includes("--apply") && arguments_.includes("--register-only")) {
    throw new Error("Use either --apply or --register-only, not both.");
  }
  const baseTaskDefinition = baseArgument?.slice(
    "--base-task-definition=".length,
  );
  if (baseArgument && !baseTaskDefinition) {
    throw new Error("--base-task-definition requires a value.");
  }
  if (arguments_.includes("--apply")) {
    if (baseArgument) throw new Error("--base-task-definition is only valid with --register-only.");
    return { mode: "apply" };
  }
  if (arguments_.includes("--register-only")) {
    return { mode: "register-only", baseTaskDefinition };
  }
  if (baseArgument) throw new Error("--base-task-definition requires --register-only.");
  return { mode: "prepare" };
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

  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? "unknown"}.`);
  }
  return result.stdout ?? "";
}
