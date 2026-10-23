import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const home = mkdtempSync(join(tmpdir(), "jetstackai-cli-test-"));
mkdirSync(join(home, ".jetstackai"));
writeFileSync(join(home, ".jetstackai", "config.json"), JSON.stringify({ instanceId: "test-instance", accessToken: "test-token", defaultFormat: "json" }));
after(() => rmSync(home, { recursive: true, force: true }));
const preload = "data:text/javascript," + encodeURIComponent(`
  const statuses = JSON.parse(process.env.TEST_STATUSES || '["incomplete"]');
  let calls = 0;
  globalThis.setTimeout = (fn) => { queueMicrotask(fn); return 0; };
  globalThis.fetch = async (url) => {
    calls++;
    const parsed = new URL(url);
    if (parsed.pathname === '/v1/tasks') return { ok: true, json: async () => ({ data: { items: [], total: 0, requestedStatus: parsed.searchParams.get('status') } }) };
    if (calls > statuses.length) throw new Error('Polled a terminal task again');
    return { ok: true, json: async () => ({ data: { id: 'task-a', name: 'Test task', status: statuses[calls - 1], progress: { total: 1, completed: 1, failed: 0 }, requestNumber: calls } }) };
  };
`);
function run(args, statuses = ["incomplete"]) {
  const result = spawnSync(process.execPath, ["--import", preload, "dist/index.js", ...args], { cwd: new URL("..", import.meta.url), env: { ...process.env, HOME: home, TEST_STATUSES: JSON.stringify(statuses) }, encoding: "utf8", timeout: 3000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
for (const command of ["import", "deploy"]) {
  for (const status of ["completed", "incomplete", "failed", "cancelled"]) {
    test(`${command} watch stops on ${status}`, () => {
      const output = run([command, "status", "task-a", "--watch"], [status]);
      assert.match(output, new RegExp('"status": "' + status + '"'));
      assert.doesNotMatch(output, /Polling every/);
      if (status === "incomplete") assert.match(output, /finished with omissions/);
    });
  }
  test(`${command} watch continues while processing then stops on incomplete`, () => {
    const output = run([command, "status", "task-a", "--watch"], ["processing", "incomplete"]);
    assert.match(output, /"requestNumber": 2/);
    assert.match(output, /finished with omissions/);
  });
}
test("tasks list forwards the incomplete status filter", () => {
  assert.equal(JSON.parse(run(["tasks", "list", "--status", "incomplete"])).requestedStatus, "incomplete");
});
test("tasks list help exposes incomplete and exact completed filtering", () => {
  assert.match(run(["tasks", "list", "--help"]), /completed excludes incomplete/);
});
