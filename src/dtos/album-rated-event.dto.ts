export interface AlbumRatedEvent {
  event: 'ALBUM_RATED';
  albumId: string;
  userId: string;
  rating: number;
  occurredAt: string;
}
