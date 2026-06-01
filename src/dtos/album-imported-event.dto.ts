export interface AlbumImportedEvent {
  event: 'ALBUM_IMPORTED';
  albumId: string;
  spotifyId?: string;
  name: string;
  artistName?: string;
  status: string;
  occurredAt: string;
}
