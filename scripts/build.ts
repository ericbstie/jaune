import { $ } from "bun";

const platform = Bun.argv[2] ?? "native";

switch (platform) {
  case "native": {
    await $`cargo tauri build --debug --no-bundle`;
    break;
  }
  case "linux":
  case "windows":
  case "mac":
  case "macos": {
    const host = {
      linux: "linux",
      mac: "darwin",
      macos: "darwin",
      windows: "win32",
    }[platform];
    if (process.platform !== host) {
      throw new Error(
        `Build ${platform} on its native operating system, or use mise run build all.`,
      );
    }
    await $`cargo tauri build --debug --no-bundle`;
    break;
  }
  case "android": {
    await $`cargo tauri android init --ci`;
    await $`cargo tauri android build --debug --apk --target aarch64 --ci`;
    break;
  }
  case "apple":
  case "ios": {
    if (process.platform !== "darwin") {
      throw new Error("iOS builds require macOS and Xcode.");
    }
    await $`cargo tauri ios init --ci`;
    await $`cargo tauri ios build --debug --target aarch64-sim --ci`;
    break;
  }
  case "all": {
    const branch = await $`git branch --show-current`.text();
    await $`gh workflow run builds.yml --ref ${branch.trim()}`;
    break;
  }
  default: {
    throw new Error(`Unknown platform: ${platform}`);
  }
}
