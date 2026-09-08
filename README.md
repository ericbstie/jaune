# Jaune

A Tauri app with a React hello-world screen.

Install [mise](https://mise.jdx.dev/getting-started.html) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system, then run:

```sh
mise install
mise run install
mise run dev
```

| Command                  | Result                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `mise run dev`           | Run the desktop app with hot reload.                                                                                                     |
| `mise run web:dev`       | Run the frontend at http://localhost:1420 for browser debugging.                                                                         |
| `mise run build`         | Build the desktop app in debug mode.                                                                                                     |
| `mise run build linux`   | Build on Linux.                                                                                                                          |
| `mise run build windows` | Build on Windows.                                                                                                                        |
| `mise run build mac`     | Build on macOS. `macos` is also accepted.                                                                                                |
| `mise run build ios`     | Build for the Apple Silicon iOS simulator on macOS with Xcode. `apple` is also accepted.                                                 |
| `mise run build android` | Build an ARM64 debug APK with the Android SDK, NDK and Java installed.                                                                   |
| `mise run build all`     | Dispatch the GitHub Actions build matrix for the current pushed branch. Requires `gh auth login` and the workflow on the default branch. |
| `mise run release`       | Build an optimized desktop executable locally. Does not publish a release.                                                               |
| `mise run checks`        | Check formatting, types, lint, unit tests, Rust and the browser UI.                                                                      |
| `mise run format`        | Format project files and Rust sources.                                                                                                   |
| `mise run test:gui`      | Check the production frontend and save screenshots in `.generated/`.                                                                     |

Bun manages application dependencies and runs tests. mise manages CLI tools and their pinned versions. Add CLI tools with `mise use --pin npm:<tool>`.

TypeScript enables strict mode, checked indexed access, exact optional properties and the additional compiler safety checks in `tsconfig.json`. Oxlint enables all rule categories and type-aware linting. Explicit exceptions support async code, the automatic JSX transform, named exports and framework objects. Oxfmt controls formatting and import order. Rust warnings and Clippy's all, pedantic and nursery groups fail checks.

The GUI test uses Bun's experimental WebView API. macOS uses system WebKit. Linux and Windows need Chrome, Chromium or Edge. Screenshots are written to `.generated/desktop.png` and `.generated/mobile.png`. These tests exercise the browser frontend. Native window behavior can be inspected with Tauri's development WebView inspector.

Use `mise.local.toml` for machine-specific environment variables. For Android, set `ANDROID_HOME`, `JAVA_HOME` and `NDK_HOME` there. The CI Android environment uses `mise.android.toml` to select its installed NDK. No `.env` file is needed.

GitHub Actions checks Linux, Windows, macOS, Android and iOS builds on pushes and pull requests. It runs the full check suite on macOS. Build outputs stay on the runner and are discarded when the job finishes.
