import express, { type ErrorRequestHandler } from 'express';
import { rankingRouter } from './ranking.controller.js';

export function startHttpServer() {
  const app = express();
  const port = Number(process.env.SERVER_PORT || process.env.PORT || 3002);

  app.use(express.json());

  app.get('/health', (_request, response) => {
    response.json({
      status: 'UP',
      service: 'clube-do-album-ranking-worker',
    });
  });

  app.use(rankingRouter);
  app.use(errorHandler);

  app.listen(port, () => {
    console.log(`Ranking HTTP server running on port ${port}`);
  });
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  console.error(error instanceof Error ? error.message : 'Unexpected HTTP error.');

  response.status(500).json({
    message: 'Internal server error.',
  });
};
