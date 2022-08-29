export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return '';
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url

  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

export const requirements = [
  { re: /[0-9]/, label: 'Includes number' },
  { re: /[a-z]/, label: 'Includes lowercase letter' },
  { re: /[A-Z]/, label: 'Includes uppercase letter' },
  { re: /[$&+,:;=?@#|'<>.^*()%!-]/, label: 'Includes special symbol' },
];

export function getStrength(password: string) {
  let multiplier = password.length > 5 ? 0 : 1;

  requirements.forEach((requirement) => {
    if (!requirement.re.test(password)) {
      multiplier += 1;
    }
  });

  return Math.max(100 - (100 / (requirements.length + 1)) * multiplier, 10);
}

export const isEmpty = (obj: Record<string, unknown>) =>
  Object.keys(obj).length === 0;

export const generateRoutesWithParams = (path: string) => {
  const [routePaths, params] = path.split('?');
  return {
    title: '',
    routes: routePaths.split('/').filter(Boolean).map(Capitalize),
    params: params.split('&'),
  };
};

export const Capitalize = (str: string) =>
  str.substring(0, 1).toUpperCase() + str.substring(1);

export const composeUrl = (url: string, params = { email: '' }) => {
  const composedUrl = new URL(url);
  return new URL(
    `${composedUrl.origin}${composedUrl.pathname}?${new URLSearchParams([
      ...Array.from(composedUrl.searchParams.entries()),
      ...Object.entries(params),
    ])}`,
  );
};

export const getSearchQuery = (searchParams: URLSearchParams) => {
  const query: Record<string, string> = {};
  const entries = searchParams.entries();
  for (const [key, value] of entries) query[key] = value;
  return query;
};
