import 'dotenv/config';
import { startAlbumImportedConsumer } from './consumers/album-imported.consumer.js';
import { startAlbumRatedConsumer } from './consumers/album-rated.consumer.js';
import { startHttpServer } from './http/server.js';

async function bootstrap() {
  console.log('clube-do-album-ranking-worker initialized');
  console.log('Ranking worker started');

  startHttpServer();
  await startAlbumImportedConsumer();
  await startAlbumRatedConsumer();
}

bootstrap().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Failed to start ranking worker.');
  process.exit(1);
});
