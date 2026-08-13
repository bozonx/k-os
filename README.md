# K-OS

Desktop scaffold based on Tauri 2, Vite, TypeScript, and Rust.

## Requirements

- Node.js 22 or newer
- pnpm 10 or newer
- Rust stable
- [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS

## Development

```sh
pnpm install
pnpm tauri dev
```

## Checks and release build

```sh
pnpm check
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
pnpm tauri build
```

Frontend code lives in `src`; native commands and Tauri configuration live in
`src-tauri`. Add permissions narrowly in `src-tauri/capabilities` as features are
introduced.

## Recommended editor setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
