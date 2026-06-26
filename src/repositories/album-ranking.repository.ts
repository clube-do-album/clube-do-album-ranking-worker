import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

interface CreateInitialRankingData {
  albumId: string;
  spotifyId?: string;
  albumName: string;
  artistName?: string;
}

interface UpdateBasicAlbumData {
  spotifyId?: string;
  albumName: string;
  artistName?: string;
}

interface SaveRatingData {
  albumId: string;
  userId: string;
  rating: number;
}

const MIN_RATINGS_FOR_RANKING = 3;
const DEFAULT_AVERAGE_RATING = 3.5;
const MIN_RATINGS_WEIGHT = 3;

export class AlbumRankingRepository {
  listRankings({ limit, skip }: { limit: number; skip: number }) {
    return prisma.albumRanking.findMany({
      take: limit,
      skip,
      where: {
        totalRatings: {
          gte: MIN_RATINGS_FOR_RANKING,
        },
      },
      orderBy: [
        {
          position: 'asc',
        },
        {
          score: 'desc',
        },
        {
          totalRatings: 'desc',
        },
      ],
    });
  }

  countRankings() {
    return prisma.albumRanking.count({
      where: {
        totalRatings: {
          gte: MIN_RATINGS_FOR_RANKING,
        },
      },
    });
  }

  findByAlbumId(albumId: string) {
    return prisma.albumRanking.findUnique({
      where: {
        albumId,
      },
    });
  }

  findByAlbumIdOrSpotifyId(albumIdOrSpotifyId: string) {
    return prisma.albumRanking.findFirst({
      where: {
        OR: [
          {
            albumId: albumIdOrSpotifyId,
          },
          {
            spotifyId: albumIdOrSpotifyId,
          },
        ],
      },
    });
  }

  createInitialRanking(data: CreateInitialRankingData) {
    return prisma.albumRanking.create({
      data: {
        albumId: data.albumId,
        spotifyId: data.spotifyId,
        albumName: data.albumName,
        artistName: data.artistName,
        averageRating: 0,
        totalRatings: 0,
        score: 0,
        position: null,
      },
    });
  }

  updateBasicAlbumData(albumId: string, data: UpdateBasicAlbumData) {
    return prisma.albumRanking.update({
      where: {
        albumId,
      },
      data: {
        spotifyId: data.spotifyId,
        albumName: data.albumName,
        artistName: data.artistName,
      },
    });
  }

  saveRatingAndRecalculate(data: SaveRatingData) {
    return prisma.$transaction(async (transaction) => {
      const rankingBySpotifyId = await transaction.albumRanking.findFirst({
        where: {
          spotifyId: data.albumId,
        },
      });

      const rankingByAlbumId = rankingBySpotifyId
        ? null
        : await transaction.albumRanking.findUnique({
            where: {
              albumId: data.albumId,
            },
          });

      const existingRanking = rankingBySpotifyId ?? rankingByAlbumId;
      const rankingAlbumId = existingRanking?.albumId ?? data.albumId;

      if (rankingBySpotifyId) {
        await transaction.albumRanking.deleteMany({
          where: {
            albumId: data.albumId,
            spotifyId: null,
            albumName: 'Album ainda nao importado',
          },
        });
      }

      if (!existingRanking) {
        console.log(
          `No imported ranking found for albumId: ${data.albumId}. Creating temporary ranking until ALBUM_IMPORTED arrives.`,
        );
      }

      if (existingRanking && rankingAlbumId !== data.albumId) {
        console.log(`Resolved rating albumId ${data.albumId} to imported albumId ${rankingAlbumId}`);
      }

      if (rankingAlbumId !== data.albumId) {
        const oldSnapshots = await transaction.albumRatingSnapshot.findMany({
          where: {
            albumId: data.albumId,
          },
        });

        await Promise.all(
          oldSnapshots.map((snapshot) =>
            transaction.albumRatingSnapshot.upsert({
              where: {
                albumId_userId: {
                  albumId: rankingAlbumId,
                  userId: snapshot.userId,
                },
              },
              create: {
                albumId: rankingAlbumId,
                userId: snapshot.userId,
                rating: snapshot.rating,
              },
              update: {
                rating: snapshot.rating,
              },
            }),
          ),
        );

        await transaction.albumRatingSnapshot.deleteMany({
          where: {
            albumId: data.albumId,
          },
        });
      }

      await transaction.albumRatingSnapshot.upsert({
        where: {
          albumId_userId: {
            albumId: rankingAlbumId,
            userId: data.userId,
          },
        },
        create: {
          albumId: rankingAlbumId,
          userId: data.userId,
          rating: data.rating,
        },
        update: {
          rating: data.rating,
        },
      });

      const aggregate = await transaction.albumRatingSnapshot.aggregate({
        where: {
          albumId: rankingAlbumId,
        },
        _avg: {
          rating: true,
        },
        _count: {
          rating: true,
        },
      });

      const averageRating = roundRating(aggregate._avg.rating ?? 0);
      const totalRatings = aggregate._count.rating;
      const score = calculateRankingScore(averageRating, totalRatings);

      const ranking = await transaction.albumRanking.upsert({
        where: {
          albumId: rankingAlbumId,
        },
        create: {
          albumId: rankingAlbumId,
          albumName: 'Album ainda nao importado',
          averageRating,
          totalRatings,
          score,
          position: null,
        },
        update: {
          averageRating,
          totalRatings,
          score,
        },
      });

      await recalculatePositions(transaction);

      return ranking;
    });
  }
}

function roundRating(value: number): number {
  return Number(value.toFixed(2));
}

function calculateRankingScore(averageRating: number, totalRatings: number): number {
  if (totalRatings < MIN_RATINGS_FOR_RANKING) {
    return 0;
  }

  const weightedScore =
    (totalRatings / (totalRatings + MIN_RATINGS_WEIGHT)) * averageRating +
    (MIN_RATINGS_WEIGHT / (totalRatings + MIN_RATINGS_WEIGHT)) * DEFAULT_AVERAGE_RATING;

  return roundRating(weightedScore);
}

async function recalculatePositions(transaction: Prisma.TransactionClient) {
  await transaction.albumRanking.updateMany({
    where: {
      totalRatings: {
        lt: MIN_RATINGS_FOR_RANKING,
      },
    },
    data: {
      position: null,
    },
  });

  const rankings = await transaction.albumRanking.findMany({
    where: {
      totalRatings: {
        gte: MIN_RATINGS_FOR_RANKING,
      },
    },
    orderBy: [
      {
        score: 'desc',
      },
      {
        totalRatings: 'desc',
      },
      {
        updatedAt: 'asc',
      },
    ],
  });

  await Promise.all(
    rankings.map((ranking, index) =>
      transaction.albumRanking.update({
        where: {
          id: ranking.id,
        },
        data: {
          position: index + 1,
        },
      }),
    ),
  );
}
