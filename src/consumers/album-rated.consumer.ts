import type { ConsumeMessage } from 'amqplib';
import type { AlbumRatedEvent } from '../dtos/album-rated-event.dto.js';
import {
  getAlbumRatedQueue,
  getAlbumRatedRoutingKey,
  getRabbitChannel,
} from '../messaging/rabbitmq.connection.js';
import { AlbumRankingService } from '../services/album-ranking.service.js';

const albumRankingService = new AlbumRankingService();

export async function startAlbumRatedConsumer() {
  const channel = await getRabbitChannel();
  const queue = getAlbumRatedQueue();
  const routingKey = getAlbumRatedRoutingKey();

  console.log(`Waiting for ${routingKey} events...`);

  await channel.consume(queue, async (message) => {
    if (!message) {
      return;
    }

    try {
      const event = parseAlbumRatedEvent(message);

      console.log(`ALBUM_RATED received for albumId: ${event.albumId}`);

      await albumRankingService.handleAlbumRated(event);
      channel.ack(message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Unexpected consumer error.');
      channel.nack(message, false, false);
    }
  });
}

function parseAlbumRatedEvent(message: ConsumeMessage): AlbumRatedEvent {
  let payload: unknown;

  try {
    payload = JSON.parse(message.content.toString('utf8'));
  } catch {
    throw new Error('Invalid JSON message received.');
  }

  if (!isAlbumRatedEvent(payload)) {
    throw new Error('Unexpected event received.');
  }

  return payload;
}

function isAlbumRatedEvent(payload: unknown): payload is AlbumRatedEvent {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const event = payload as Partial<AlbumRatedEvent>;

  return (
    event.event === 'ALBUM_RATED' &&
    typeof event.albumId === 'string' &&
    typeof event.userId === 'string' &&
    typeof event.rating === 'number' &&
    event.rating >= 0.5 &&
    event.rating <= 5 &&
    typeof event.occurredAt === 'string'
  );
}
