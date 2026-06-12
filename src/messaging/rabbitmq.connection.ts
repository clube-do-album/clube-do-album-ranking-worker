import amqp, { type Channel, type ChannelModel } from 'amqplib';

let connection: ChannelModel | undefined;
let channel: Channel | undefined;

export function getRabbitExchange() {
  return process.env.RABBITMQ_EXCHANGE?.trim() || 'clube-do-album.events';
}

export function getDeadLetterExchange() {
  return process.env.RABBITMQ_DEAD_LETTER_EXCHANGE?.trim() || 'clube-do-album.dead-letter';
}

export function getAlbumImportedQueue() {
  return process.env.ALBUM_IMPORTED_QUEUE?.trim() || 'ranking.album-imported.queue';
}

export function getAlbumImportedRoutingKey() {
  return process.env.ALBUM_IMPORTED_ROUTING_KEY?.trim() || 'album.imported';
}

export function getAlbumRatedQueue() {
  return process.env.ALBUM_RATED_QUEUE?.trim() || 'ranking.album-rated.queue';
}

export function getAlbumRatedRoutingKey() {
  return process.env.ALBUM_RATED_ROUTING_KEY?.trim() || 'album.rated';
}

export async function getRabbitChannel(): Promise<Channel> {
  if (channel) {
    return channel;
  }

  const rabbitUrl = process.env.RABBITMQ_URL?.trim() || 'amqp://clube:clube@localhost:5672';
  const rabbitConnection = await amqp.connect(rabbitUrl);
  const rabbitChannel = await rabbitConnection.createChannel();

  await rabbitChannel.assertExchange(getRabbitExchange(), 'topic', {
    durable: true,
  });

  await rabbitChannel.assertExchange(getDeadLetterExchange(), 'direct', {
    durable: true,
  });

  await setupConsumerQueue(rabbitChannel, getAlbumImportedQueue(), getAlbumImportedRoutingKey());
  await setupConsumerQueue(rabbitChannel, getAlbumRatedQueue(), getAlbumRatedRoutingKey());

  connection = rabbitConnection;
  channel = rabbitChannel;

  return rabbitChannel;
}

export async function setupConsumerQueue(
  rabbitChannel: Channel,
  queue: string,
  routingKey: string,
) {
  const deadLetterQueue = `${queue}.dlq`;
  const deadLetterRoutingKey = `${queue}.dead`;

  await rabbitChannel.assertQueue(deadLetterQueue, {
    durable: true,
  });

  await rabbitChannel.bindQueue(deadLetterQueue, getDeadLetterExchange(), deadLetterRoutingKey);

  await rabbitChannel.assertQueue(queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': getDeadLetterExchange(),
      'x-dead-letter-routing-key': deadLetterRoutingKey,
    },
  });

  await rabbitChannel.bindQueue(queue, getRabbitExchange(), routingKey);
}

export async function closeRabbitConnection() {
  if (channel) {
    await channel.close();
    channel = undefined;
  }

  if (connection) {
    await connection.close();
    connection = undefined;
  }
}
