export const hostingPlaform = {
  vercel: {
    hostname: process.env.VERCEL_URL ?? '',
    url: `https://${process.env.VERCEL_URL}`,
  },
  render: {
    hostname: process.env.RENDER_EXTERNAL_HOSTNAME ?? '',
    url: process.env.RENDER_EXTERNAL_URL ?? '',
  },
};

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '';
  if (process.env.VERCEL_URL) return hostingPlaform['vercel']['url'];
  if (process.env.RENDER_EXTERNAL_URL) return hostingPlaform['render']['url'];
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

export const getHostname = (): string => {
  if (process.env.VERCEL_URL) return hostingPlaform.vercel['hostname'];
  if (process.env.RENDER_EXTERNAL_URL) return hostingPlaform.render['hostname'];
  return '';
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

export const numberFormater = (number: number) =>
  new Intl.NumberFormat().format(number);

export const currencyFormatter = (value: number, currency = 'NGN') => {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(
    value,
  );
};

export const imgUrl =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=250&q=80';

export const femaleImageUrl =
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?ixid=MXwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHw%3D&ixlib=rb-1.2.1&auto=format&fit=crop&w=255&q=80';

export function isValidDate(input: any) {
  return (
    Object.prototype.toString.call(input) === '[object Date]' &&
    !isNaN(input.valueOf() && input instanceof Date)
  );
}
