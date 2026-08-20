import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const terraformDirectory = join(repositoryRoot, "terraform");
const frontendDirectory = join(repositoryRoot, "frontend");
const distDirectory = join(frontendDirectory, "dist");
const skipInstall = parseArguments(process.argv.slice(2));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "btc-game-frontend-"));
const artifactPath = join(temporaryDirectory, "frontend.zip");

try {
  const appId = run(
    "terraform",
    [`-chdir=${terraformDirectory}`, "output", "-raw", "amplify_app_id"],
    { captureOutput: true },
  ).trim();
  const createPlayerUrl = run(
    "terraform",
    [`-chdir=${terraformDirectory}`, "output", "-raw", "create_player_url"],
    { captureOutput: true },
  ).trim();
  const createBetUrl = run(
    "terraform",
    [`-chdir=${terraformDirectory}`, "output", "-raw", "create_bet_url"],
    { captureOutput: true },
  ).trim();

  if (!skipInstall) {
    run("pnpm", ["install", "--frozen-lockfile"], { cwd: frontendDirectory });
  }

  run("pnpm", ["run", "build"], {
    cwd: frontendDirectory,
    env: {
      ...process.env,
      VITE_CREATE_PLAYER_URL: createPlayerUrl,
      VITE_CREATE_BET_URL: createBetUrl,
    },
  });

  await createZip(distDirectory, artifactPath);

  const deployment = JSON.parse(
    run(
      "aws",
      [
        "amplify",
        "create-deployment",
        "--app-id",
        appId,
        "--branch-name",
        "main",
        "--output",
        "json",
      ],
      { captureOutput: true },
    ),
  );

  if (
    typeof deployment?.zipUploadUrl !== "string" ||
    typeof deployment?.jobId !== "string"
  ) {
    throw new Error("Amplify returned an invalid deployment response.");
  }

  const uploadResponse = await fetch(deployment.zipUploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/zip" },
    body: await readFile(artifactPath),
  });
  if (!uploadResponse.ok) {
    throw new Error(`Amplify upload failed (${uploadResponse.status}).`);
  }

  run("aws", [
    "amplify",
    "start-deployment",
    "--app-id",
    appId,
    "--branch-name",
    "main",
    "--job-id",
    deployment.jobId,
  ]);

  console.log(`Started Amplify deployment job ${deployment.jobId} for app ${appId}.`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function parseArguments(arguments_) {
  const supported = new Set(["--skip-install"]);
  const unknown = arguments_.filter((argument) => !supported.has(argument));
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(", ")}`);
  }

  return arguments_.includes("--skip-install");
}

function run(command, arguments_, options = {}) {
  let executable = command;
  let commandArguments = arguments_;

  if (process.platform === "win32" && command === "pnpm") {
    if (arguments_.some((argument) => !/^[a-zA-Z0-9._-]+$/.test(argument))) {
      throw new Error("pnpm received an unsafe command argument.");
    }
    executable = process.env.ComSpec ?? "cmd.exe";
    commandArguments = ["/d", "/s", "/c", ["pnpm", ...arguments_].join(" ")];
  }

  const result = spawnSync(executable, commandArguments, {
    cwd: options.cwd ?? repositoryRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.captureOutput ? ["inherit", "pipe", "inherit"] : "inherit",
  });

  if (result.error) {
    throw new Error(`Could not run ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? "unknown"}.`);
  }

  return result.stdout ?? "";
}

async function createZip(sourceDirectory, destination) {
  const files = await listFiles(sourceDirectory);
  if (files.length === 0) {
    throw new Error(`Frontend build output is empty: ${sourceDirectory}`);
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = relative(sourceDirectory, file).split(sep).join("/");
    const nameBuffer = Buffer.from(name, "utf8");
    const contents = await readFile(file);
    const compressed = deflateRawSync(contents);
    const checksum = crc32(contents);
    const { date, time } = dosDateTime((await stat(file)).mtime);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(contents.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(contents.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBuffer, compressed);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  await writeFile(destination, Buffer.concat([...localParts, centralDirectory, end]));
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }

  return files.sort();
}

function dosDateTime(value) {
  const year = Math.max(value.getFullYear(), 1980);
  return {
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | (value.getSeconds() >> 1),
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
