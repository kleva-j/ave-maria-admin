import { runTwenty } from './run-twenty';

function validateEnv(): { apiUrl: string; apiKey: string } {
  const apiUrl = process.env.TWENTY_API_URL;
  const apiKey = process.env.TWENTY_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error(
      'TWENTY_API_URL and TWENTY_API_KEY must be set.\n' +
        'Start a local server: yarn twenty docker:start\n' +
        'Or set them in vitest env config.',
    );
  }

  return { apiUrl, apiKey };
}

async function getMetadataValidationDetails(apiUrl: string, apiKey: string) {
  const buildResult = await runTwenty(['app', 'build']);

  if (!buildResult.ok) {
    return `Could not rebuild the app manifest: ${JSON.stringify(buildResult.error)}`;
  }

  const manifest = (buildResult.data as { manifest?: unknown }).manifest;

  if (!manifest) {
    return 'The Twenty CLI build result did not include a manifest.';
  }

  let response: Response;

  try {
    response = await fetch(`${apiUrl.replace(/\/$/, '')}/metadata`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query:
          'mutation PreviewApplication($manifest: JSON!) { ' +
          'syncApplication(manifest: $manifest, dryRun: true) { ' +
          'applicationUniversalIdentifier actions } }',
        variables: { manifest },
      }),
    });
  } catch (error) {
    return `Could not request the read-only metadata preview: ${String(error)}`;
  }

  const body: unknown = await response.json().catch(() => null);
  const errors =
    typeof body === 'object' && body !== null && 'errors' in body
      ? body.errors
      : undefined;

  if (!Array.isArray(errors) || errors.length === 0) {
    return `The diagnostic preview returned HTTP ${response.status} without GraphQL validation errors.`;
  }

  return JSON.stringify(
    {
      status: response.status,
      errors: errors.map((error) => {
        if (typeof error !== 'object' || error === null) {
          return error;
        }

        const graphqlError = error as {
          message?: unknown;
          extensions?: unknown;
        };

        return {
          message: graphqlError.message,
          extensions: graphqlError.extensions,
        };
      }),
    },
    null,
    2,
  );
}

async function checkServer(apiUrl: string) {
  let response: Response;

  try {
    response = await fetch(`${apiUrl}/healthz`);
  } catch {
    throw new Error(
      `Twenty server is not reachable at ${apiUrl}. ` +
        'Make sure the server is running before executing integration tests.',
    );
  }

  if (!response.ok) {
    throw new Error(`Server at ${apiUrl} returned ${response.status}`);
  }
}

export async function setup() {
  const { apiUrl, apiKey } = validateEnv();

  await checkServer(apiUrl);
  await runTwenty(['app', 'uninstall', '--yes']);

  const result = await runTwenty(['app', 'apply', '--create']);

  if (!result.ok) {
    const validationDetails =
      result.error.code === 'GRAPHQL_ERROR' &&
      result.error.message.includes('Validation errors')
        ? await getMetadataValidationDetails(apiUrl, apiKey)
        : undefined;

    throw new Error(
      `App apply failed: ${JSON.stringify(result.error, null, 2)}` +
        (validationDetails
          ? `\nMetadata validation details: ${validationDetails}`
          : ''),
    );
  }
}

export async function teardown() {
  const result = await runTwenty(['app', 'uninstall', '--yes']);

  if (!result.ok) {
    console.warn(`App uninstall failed: ${result.error.message}`);
  }
}
