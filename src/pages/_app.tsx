import type { AppRouter } from 'server/routers/_app';

import { useLocalStorage, useHotkeys, useColorScheme } from '@mantine/hooks';
import { RouterTransition } from 'components/molecules/RouterTransition';
import { wsLink, createWSClient } from '@trpc/client/links/wsLink';
import { httpBatchLink } from '@trpc/client/links/httpBatchLink';
import { getSession, SessionProvider } from 'next-auth/react';
import { loggerLink } from '@trpc/client/links/loggerLink';
import { splitLink } from '@trpc/client/links/splitLink';
import { httpLink } from '@trpc/client/links/httpLink';
import { AppType } from 'next/dist/shared/lib/utils';
import { useRouter } from 'next/router';
import { withTRPC } from '@trpc/next';
import { getBaseUrl } from 'helpers';
import { Seo } from 'components/seo';
import { ReactNode } from 'react';
import {
  ColorSchemeProvider,
  MantineProvider,
  ColorScheme,
} from '@mantine/core';

import GlobalThemeConfig from 'utils/theme';
import getConfig from 'next/config';
import superjson from 'superjson';
import Layout from 'layout';

const { publicRuntimeConfig } = getConfig();
const { APP_URL, WS_URL } = publicRuntimeConfig;

const baseUrl = getBaseUrl();

const MyApp: AppType = (props) => {
  const {
    Component,
    pageProps: { session, ...pageProps },
  } = props;
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

const url = `${APP_URL ?? process.env.VERCEL_URL}/api/trpc`;

function getEndingLink() {
  return typeof window === 'undefined'
    ? splitLink({
        condition(op) {
          return op.context.skipBatch === true;
        },
        true: httpLink({ url }),
        false: httpBatchLink({ url }),
      })
    : wsLink<AppRouter>({
        client: createWSClient({ url: WS_URL ?? process.env.VERCEL_URL }),
      });
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
