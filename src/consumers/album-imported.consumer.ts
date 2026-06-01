import type { ConsumeMessage } from 'amqplib';
import type { AlbumImportedEvent } from '../dtos/album-imported-event.dto.js';
import {
  getAlbumImportedQueue,
  getAlbumImportedRoutingKey,
  getRabbitChannel,
} from '../messaging/rabbitmq.connection.js';
import { AlbumRankingService } from '../services/album-ranking.service.js';

const albumRankingService = new AlbumRankingService();

export async function startAlbumImportedConsumer() {
  const channel = await getRabbitChannel();
  const queue = getAlbumImportedQueue();
  const routingKey = getAlbumImportedRoutingKey();

  console.log(`Waiting for ${routingKey} events...`);

  await channel.consume(queue, async (message) => {
    if (!message) {
      return;
    }

    try {
      const event = parseAlbumImportedEvent(message);

      console.log(`ALBUM_IMPORTED received for album: ${event.name}`);

      await albumRankingService.handleAlbumImported(event);
      channel.ack(message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Unexpected consumer error.');
      channel.nack(message, false, false);
    }
  });
}

function parseAlbumImportedEvent(message: ConsumeMessage): AlbumImportedEvent {
  let payload: unknown;

  try {
    payload = JSON.parse(message.content.toString('utf8'));
  } catch {
    throw new Error('Invalid JSON message received.');
  }

  if (!isAlbumImportedEvent(payload)) {
    throw new Error('Unexpected event received.');
  }

  return payload;
}

function isAlbumImportedEvent(payload: unknown): payload is AlbumImportedEvent {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const event = payload as Partial<AlbumImportedEvent>;

  return (
    event.event === 'ALBUM_IMPORTED' &&
    typeof event.albumId === 'string' &&
    typeof event.name === 'string' &&
    typeof event.status === 'string' &&
    typeof event.occurredAt === 'string'
  );
}
