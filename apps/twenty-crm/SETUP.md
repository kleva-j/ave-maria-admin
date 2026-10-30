# Setup

This app uses Twenty's Yarn 4 app toolchain and requires Node.js 24.5 or newer.
The repository root `.nvmrc` selects Node.js 24.5.0.

## Connect to the staging server

1. Start `apps/twenty-server` and finish the initial Twenty workspace setup.
2. Use the local URL, or the current HTTPS tunnel URL if connecting from
   another machine.
3. Enable Corepack and install the app dependencies:

   ```sh
   corepack enable
   yarn install
   ```

4. Install the matching standalone Twenty CLI:

   ```sh
npm install --global twenty@2.51.3
```

The first root `pnpm dev` opens browser sign-in to create the dedicated
`avm-staging` profile if it is missing. You can configure it before startup
with `twenty auth login --url http://localhost:3000 --name avm-staging --use`.
If you are connecting through a tunnel, use its current HTTPS URL instead.

   The CLI stores the login in the user's Twenty configuration directory,
   outside this repository. Do not put API keys or other credentials in app
   source files.

From the repository root, `pnpm dev` starts the Twenty Compose server and the
authenticated app watcher (`twenty app dev --remote avm-staging`) alongside the
web, native, marketing, and backend dev tasks. The watcher live-syncs schema
source changes to the authenticated staging instance. It uses `--create` to
register the app if needed and `--no-delete` to preserve remote schema entities
missing from local source. Review changes before applying them and do not
connect production data during Phase 1.

## Checks

```sh
yarn typecheck
yarn test:unit
```

The integration suite requires a running Twenty instance and authenticated
test credentials. The schema is intentionally not applied automatically by
these local checks.
