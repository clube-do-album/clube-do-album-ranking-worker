import { Router } from 'express';
import { AlbumRankingService } from '../services/album-ranking.service.js';

const albumRankingService = new AlbumRankingService();

export const rankingRouter = Router();

rankingRouter.get('/rankings', async (request, response, next) => {
  try {
    const rawLimit = request.query.limit;
    const limit = normalizeLimit(typeof rawLimit === 'string' ? rawLimit : undefined);
    const page = normalizePage(request.query.page);
    const rankings = await albumRankingService.listRankings({ page, limit });

    response.json(rankings);
  } catch (error) {
    next(error);
  }
});

rankingRouter.get('/rankings/:albumId', async (request, response, next) => {
  try {
    const ranking = await albumRankingService.findRanking(request.params.albumId);

    if (!ranking) {
      response.status(404).json({
        message: 'Ranking not found.',
      });
      return;
    }

    response.json(ranking);
  } catch (error) {
    next(error);
  }
});

function normalizeLimit(value?: string): number {
  if (!value) {
    return 20;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 20;
  }

  return Math.min(parsed, 100);
}

function normalizePage(value: unknown): number {
  if (typeof value !== 'string') {
    return 1;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}
