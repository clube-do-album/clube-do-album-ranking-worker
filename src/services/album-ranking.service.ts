import type { AlbumImportedEvent } from '../dtos/album-imported-event.dto.js';
import type { AlbumRatedEvent } from '../dtos/album-rated-event.dto.js';
import { AlbumRankingRepository } from '../repositories/album-ranking.repository.js';

const albumRankingRepository = new AlbumRankingRepository();

export class AlbumRankingService {
  async listRankings(limit: number) {
    return albumRankingRepository.listRankings(limit);
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
