// fetch() that honours HTTP(S)_PROXY / NO_PROXY (Node's built-in fetch ignores them).
import { EnvHttpProxyAgent, setGlobalDispatcher, fetch as undiciFetch } from 'undici';

const env = process.env;
if (env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy) setGlobalDispatcher(new EnvHttpProxyAgent());

export const fetch = undiciFetch;
