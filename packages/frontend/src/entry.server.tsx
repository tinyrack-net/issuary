import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { type EntryContext, ServerRouter } from 'react-router';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
) {
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error) {
        responseStatusCode = 500;
        console.error(error);
      },
    },
  );
  const userAgent = request.headers.get('user-agent');
  if (userAgent !== null && isbot(userAgent)) await body.allReady;
  responseHeaders.set('Content-Type', 'text/html');
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
