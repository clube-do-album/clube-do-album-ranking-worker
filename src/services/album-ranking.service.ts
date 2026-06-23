import type { AlbumImportedEvent } from '../dtos/album-imported-event.dto.js';
import type { AlbumRatedEvent } from '../dtos/album-rated-event.dto.js';
import { AlbumRankingRepository } from '../repositories/album-ranking.repository.js';

const albumRankingRepository = new AlbumRankingRepository();

export class AlbumRankingService {
  async listRankings({ page, limit }: { page: number; limit: number }) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      albumRankingRepository.listRankings({ limit, skip }),
      albumRankingRepository.countRankings(),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNextPage: page * limit < total,
    };
  }

  async findRanking(albumIdOrSpotifyId: string) {
    return albumRankingRepository.findByAlbumIdOrSpotifyId(albumIdOrSpotifyId);
  }

  async handleAlbumImported(event: AlbumImportedEvent): Promise<void> {
    const existingRanking = await albumRankingRepository.findByAlbumId(event.albumId);

    if (existingRanking) {
      await albumRankingRepository.updateBasicAlbumData(event.albumId, {
        spotifyId: event.spotifyId,
        albumName: event.name,
        artistName: event.artistName,
      });

      console.log(`Initial ranking updated for albumId: ${event.albumId}`);
      return;
    }

    await albumRankingRepository.createInitialRanking({
      albumId: event.albumId,
      spotifyId: event.spotifyId,
      albumName: event.name,
      artistName: event.artistName,
    });

    console.log(`Initial ranking created for albumId: ${event.albumId}`);
  }

  async handleAlbumRated(event: AlbumRatedEvent): Promise<void> {
    const ranking = await albumRankingRepository.saveRatingAndRecalculate({
      albumId: event.albumId,
      userId: event.userId,
      rating: event.rating,
    });

    console.log(
      `Ranking recalculated for albumId: ${ranking.albumId} | average: ${ranking.averageRating} | total: ${ranking.totalRatings}`,
    );
  }
}
