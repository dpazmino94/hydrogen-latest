import {RemixServer} from '@remix-run/react';
import isbot from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

/**
 * @param {Request} request
 * @param {number} responseStatusCode
 * @param {Headers} responseHeaders
 * @param {EntryContext} remixContext
 */
export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    scriptSrc: [
      'self',
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://web-assets-stg.s3.amazonaws.com',
      'unsafe-inline',
      'unsafe-eval',
      'https://content.shoprunner.com',
      'https://assets.prd.shoprunner.io',
      'https://dp.shoprunner.com/',
      'https://shippingoptions.prd.shoprunner.io/',
      'https://assets.stg.shoprunner.io/',
      'http://localhost:3000/',
      'https://activate.shoprunner.com/',
    ],
    frameSrc: [
      'https://content.shoprunner.com/',
      'https://activate.shoprunner.com/',
      'https://login.shoprunner.com/',
    ],
    defaultSrc: [
      'http://dp.shoprunner.com/',
      'https://content.shoprunner.com/',
    ],
    connectSrc: [
      'https://api.shoprunner.com/',
      'https://shippingoptions.prd.shoprunner.io/',
      'https://shopifyconnector.wip.shoprunner.io/',
      'https://shoprunner-demo-01.myshopify.com/', //STORE URL
    ],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        // eslint-disable-next-line no-console
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

/** @typedef {import('@shopify/remix-oxygen').EntryContext} EntryContext */
