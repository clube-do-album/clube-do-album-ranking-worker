import amqp, { type Channel, type ChannelModel } from 'amqplib';

let connection: ChannelModel | undefined;
let channel: Channel | undefined;

export function getRabbitExchange() {
  return process.env.RABBITMQ_EXCHANGE?.trim() || 'clube-do-album.events';
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

  await rabbitChannel.assertQueue(getAlbumImportedQueue(), {
    durable: true,
  });

  await rabbitChannel.bindQueue(
    getAlbumImportedQueue(),
    getRabbitExchange(),
    getAlbumImportedRoutingKey(),
  );

  await rabbitChannel.assertQueue(getAlbumRatedQueue(), {
    durable: true,
  });

  await rabbitChannel.bindQueue(
    getAlbumRatedQueue(),
    getRabbitExchange(),
    getAlbumRatedRoutingKey(),
  );

  connection = rabbitConnection;
  channel = rabbitChannel;

  return rabbitChannel;
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
