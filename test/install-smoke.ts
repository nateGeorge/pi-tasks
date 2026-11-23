import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const agentDir = mkdtempSync(resolve(tmpdir(), "pi-tasks-agent-smoke-"));

try {
	const commit = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: repoRoot,
		encoding: "utf8",
	}).trim();
	const source = `git:github.com/nateGeorge/pi-tasks@${commit}`;
	const installEnv = { ...process.env, PI_CODING_AGENT_DIR: agentDir };
	delete installEnv.PI_OFFLINE;

	execFileSync("pi", ["install", source], {
		cwd: agentDir,
		env: installEnv,
		stdio: "pipe",
		timeout: 120_000,
	});

	const responseId = "pi-tasks-install-smoke";
	const rpc = execFileSync(
		"pi",
		["--mode", "rpc", "--no-session", "--no-mcp"],
		{
			cwd: agentDir,
			env: { ...installEnv, PI_OFFLINE: "1" },
			input: `${JSON.stringify({ id: responseId, type: "get_commands" })}\n`,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 30_000,
		},
	);
	const response = rpc
		.split("\n")
		.filter((line) => line.length > 0)
		.map(
			(line) =>
				JSON.parse(line) as {
					id?: string;
					command?: string;
					success?: boolean;
					data?: { commands?: { name?: string }[] };
				},
		)
		.find(
			(record) => record.id === responseId && record.command === "get_commands",
		);
	if (!response?.success)
		throw new Error("Pi RPC did not return get_commands successfully");
	if (
		!response.data?.commands?.some(
			(command) => command.name?.replace(/^\//u, "") === "tasks",
		)
	) {
		throw new Error("Fresh pinned-git install did not register /tasks");
	}
	console.log(`Fresh pinned-git install registered /tasks at ${commit}`);
} finally {
	rmSync(agentDir, { recursive: true, force: true });
}
