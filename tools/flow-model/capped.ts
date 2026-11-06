// Runs a command inside a Windows job object with a hard memory limit and a timeout, so a runaway
// process is killed by the operating system instead of exhausting the machine.
// Usage: deno task --cwd tools/flow-model capped [--cwd=<dir>] <memoryMB> <timeoutSeconds> <command> [args...]
// The command runs in --cwd, which defaults to tools/flow-model (use --cwd=../.. for the project root).
// The exit code is the command's, or 124 on timeout.

const JOB_OBJECT_LIMIT_JOB_MEMORY = 0x200;
const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000;
const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9;
const PROCESS_TERMINATE = 0x0001;
const PROCESS_SET_QUOTA = 0x0100;
/** Size of JOBOBJECT_EXTENDED_LIMIT_INFORMATION on 64-bit Windows, and the offsets of the fields set here. */
const INFO_SIZE = 144;
const LIMIT_FLAGS_OFFSET = 16;
const JOB_MEMORY_LIMIT_OFFSET = 120;
const PEAK_JOB_MEMORY_OFFSET = 136;
/** A failed command whose peak memory reached this share of the limit is reported as stopped by the cap. */
const CAP_SHARE = 0.9;

const kernel32 = Deno.dlopen(
  "kernel32.dll",
  {
    CreateJobObjectW: { parameters: ["pointer", "pointer"], result: "pointer" },
    SetInformationJobObject: {
      parameters: ["pointer", "i32", "buffer", "u32"],
      result: "i32",
    },
    AssignProcessToJobObject: {
      parameters: ["pointer", "pointer"],
      result: "i32",
    },
    QueryInformationJobObject: {
      parameters: ["pointer", "i32", "buffer", "u32", "pointer"],
      result: "i32",
    },
    OpenProcess: { parameters: ["u32", "i32", "u32"], result: "pointer" },
    CloseHandle: { parameters: ["pointer"], result: "i32" },
    GetLastError: { parameters: [], result: "u32" },
  } as const,
);

/** A job object that limits the memory of every process assigned to it, and kills them when it closes. */
export class MemoryJob {
  readonly #handle: Deno.PointerValue;

  constructor(limitMegabytes: number) {
    this.#handle = kernel32.symbols.CreateJobObjectW(null, null);
    if (this.#handle === null) {
      throw new Error(
        `CreateJobObject failed (${kernel32.symbols.GetLastError()})`,
      );
    }
    const info = new ArrayBuffer(INFO_SIZE);
    const view = new DataView(info);
    view.setUint32(
      LIMIT_FLAGS_OFFSET,
      JOB_OBJECT_LIMIT_JOB_MEMORY | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
      true,
    );
    view.setBigUint64(
      JOB_MEMORY_LIMIT_OFFSET,
      BigInt(limitMegabytes) * 1024n * 1024n,
      true,
    );
    const ok = kernel32.symbols.SetInformationJobObject(
      this.#handle,
      JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
      new Uint8Array(info),
      INFO_SIZE,
    );
    if (!ok) {
      throw new Error(
        `SetInformationJobObject failed (${kernel32.symbols.GetLastError()})`,
      );
    }
  }

  assign(pid: number): void {
    const process = kernel32.symbols.OpenProcess(
      PROCESS_SET_QUOTA | PROCESS_TERMINATE,
      0,
      pid,
    );
    if (process === null) {
      throw new Error(
        `OpenProcess failed (${kernel32.symbols.GetLastError()})`,
      );
    }
    try {
      if (!kernel32.symbols.AssignProcessToJobObject(this.#handle, process)) {
        throw new Error(
          `AssignProcessToJobObject failed (${kernel32.symbols.GetLastError()})`,
        );
      }
    } finally {
      kernel32.symbols.CloseHandle(process);
    }
  }

  /** The most memory, in megabytes, that the processes of the job held at once. */
  peakMegabytes(): number {
    const info = new ArrayBuffer(INFO_SIZE);
    const ok = kernel32.symbols.QueryInformationJobObject(
      this.#handle,
      JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
      new Uint8Array(info),
      INFO_SIZE,
      null,
    );
    if (!ok) {
      throw new Error(
        `QueryInformationJobObject failed (${kernel32.symbols.GetLastError()})`,
      );
    }
    const peak = new DataView(info).getBigUint64(PEAK_JOB_MEMORY_OFFSET, true);
    return Number(peak / (1024n * 1024n));
  }

  /** Closing the job kills any process still in it. */
  close(): void {
    kernel32.symbols.CloseHandle(this.#handle);
  }
}

/** Runs the command under the limit and returns its exit code, or 124 when the timeout kills it. */
export async function runCapped(
  command: string,
  args: string[],
  limitMegabytes: number,
  timeoutSeconds: number,
  cwd?: string,
): Promise<number> {
  const job = new MemoryJob(limitMegabytes);
  try {
    const child = new Deno.Command(command, {
      args,
      cwd,
      stdin: "null",
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
    try {
      job.assign(child.pid);
    } catch (error) {
      // Never let the command run without the limit.
      child.kill("SIGKILL");
      await child.status;
      throw error;
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutSeconds * 1000);
    const status = await child.status;
    clearTimeout(timer);
    if (timedOut) {
      console.error(`capped: timeout of ${timeoutSeconds} seconds fired`);
      return 124;
    }
    if (status.code !== 0 && job.peakMegabytes() >= limitMegabytes * CAP_SHARE) {
      console.error(
        `capped: memory cap of ${limitMegabytes} MB fired (peak ${job.peakMegabytes()} MB)`,
      );
    }
    return status.code;
  } finally {
    job.close();
  }
}

if (import.meta.main) {
  const all = [...Deno.args];
  const cwd = all[0]?.startsWith("--cwd=")
    ? all.shift()!.slice("--cwd=".length)
    : undefined;
  const [memory, timeout, command, ...args] = all;
  if (Deno.build.os !== "windows" || !memory || !timeout || !command) {
    console.error(
      "usage (Windows only): deno task --cwd tools/flow-model capped [--cwd=<dir>] <memoryMB> <timeoutSeconds> <command> [args...]",
    );
    Deno.exit(2);
  }
  Deno.exit(
    await runCapped(command, args, Number(memory), Number(timeout), cwd),
  );
}
