import type { AppRouter } from 'server/routers/_app';

import {
  ColorScheme,
  ColorSchemeProvider,
  MantineProvider
} from '@mantine/core';
import { useColorScheme, useHotkeys, useLocalStorage } from '@mantine/hooks';
import { httpBatchLink } from '@trpc/client/links/httpBatchLink';
import { httpLink } from '@trpc/client/links/httpLink';
import { loggerLink } from '@trpc/client/links/loggerLink';
import { splitLink } from '@trpc/client/links/splitLink';
import { createWSClient, wsLink } from '@trpc/client/links/wsLink';
import { withTRPC } from '@trpc/next';
import { RouterTransition } from 'components/molecules/RouterTransition';
import { Seo } from 'components/seo';
import { getBaseUrl, getHostname } from 'helpers';
import { getSession, SessionProvider } from 'next-auth/react';
import { AppType } from 'next/dist/shared/lib/utils';
import { useRouter } from 'next/router';
import { ReactNode } from 'react';

import Layout from 'layout';
import getConfig from 'next/config';
import superjson from 'superjson';
import GlobalThemeConfig from 'utils/theme';

const { publicRuntimeConfig } = getConfig();
const { APP_URL, WS_URL } = publicRuntimeConfig;

const baseUrl = getBaseUrl();

const url = `${APP_URL ?? baseUrl}/api/trpc`;
const ws_url =
  process.env.NODE_ENV === 'development' ? WS_URL : `wss://${getHostname()}`;

const MyApp: AppType = (props) => {
  const { Component, pageProps } = props;
  const { session } = pageProps as any;
  const router = useRouter();
  const {
    isProtected = false,
    pageTitle = '',
    Wrapper = (children?: ReactNode) =>
      isProtected ? <Layout>{children}</Layout> : <>{children}</>,
  } = { ...Component };

  const [colorScheme, setColorScheme] = useLocalStorage<ColorScheme>({
    key: 'gitline-color-scheme',
    defaultValue: useColorScheme(session?.user ? 'dark' : 'light'),
    getInitialValueInEffect: true,
  });

  const toggleColorScheme = (value?: ColorScheme) =>
    setColorScheme(value || (colorScheme === 'dark' ? 'light' : 'dark'));

  useHotkeys([['mod+J', () => toggleColorScheme()]]);

  return (
    <ColorSchemeProvider
      colorScheme={colorScheme}
      toggleColorScheme={toggleColorScheme}
    >
      <MantineProvider
        withGlobalStyles
        withNormalizeCSS
        theme={{
          colorScheme,
          ...GlobalThemeConfig,
          primaryColor: colorScheme === 'dark' ? 'ocean-blue' : 'violet',
        }}
      >
        <SessionProvider session={session}>
          <>
            <RouterTransition />
            <Seo canonical={baseUrl + router.asPath} title={pageTitle} />
            {Wrapper(<Component {...pageProps} />)}
          </>
        </SessionProvider>
      </MantineProvider>
    </ColorSchemeProvider>
  );
};

MyApp.getInitialProps = async ({ ctx }) => {
  return { pageProps: { session: await getSession(ctx) } };
};

function getEndingLink() {
  return typeof window === 'undefined'
    ? splitLink({
        condition(op) {
          return op.context.skipBatch === true;
        },
        true: httpLink({ url }),
        false: httpBatchLink({ url }),
      })
    : wsLink<AppRouter>({ client: createWSClient({ url: ws_url }) });
}

export default withTRPC<AppRouter>({
  config({ ctx }) {
    return {
      links: [
        loggerLink({
          enabled: (opts) =>
            (process.env.NODE_ENV === 'development' &&
              typeof window !== 'undefined') ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        getEndingLink(),
      ],
      transformer: superjson,
      queryClientConfig: { defaultOptions: { queries: { staleTime: 60 } } },
      headers: () => {
        return ctx?.req ? { ...ctx.req.headers, 'x-ssr': '1' } : {};
      },
    };
  },
  ssr: true,
})(MyApp);
