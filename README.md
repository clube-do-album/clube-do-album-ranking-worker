# Clube do Album Ranking Worker

Worker responsavel pelo processamento de eventos de ranking da plataforma Clube do Album.

## Responsabilidade

- Consumir eventos `ALBUM_IMPORTED` publicados pela Catalog API.
- Criar um registro inicial de ranking para albuns importados.
- Atualizar dados basicos do ranking caso o mesmo evento seja recebido novamente.
- Consumir eventos `ALBUM_RATED` publicados pela Ratings API.
- Salvar a ultima nota de cada usuario por album.
- Recalcular media, total de avaliacoes, score e posicao do ranking.
- Expor endpoints HTTP para consultar o ranking calculado.

## Tecnologias usadas

- Node.js
- TypeScript
- Prisma
- PostgreSQL
- RabbitMQ

## Variaveis de ambiente

Crie um arquivo local a partir do exemplo:

```bash
cp .env.example .env
```

Variaveis esperadas:

```env
DATABASE_URL=postgresql://clube:clube@127.0.0.1:15432/clube_do_album_ranking
RABBITMQ_URL=amqp://clube:clube@localhost:5672
SERVER_PORT=3002

RABBITMQ_EXCHANGE=clube-do-album.events
RABBITMQ_DEAD_LETTER_EXCHANGE=clube-do-album.dead-letter
ALBUM_IMPORTED_QUEUE=ranking.album-imported.queue
ALBUM_IMPORTED_ROUTING_KEY=album.imported
ALBUM_RATED_QUEUE=ranking.album-rated.queue
ALBUM_RATED_ROUTING_KEY=album.rated
```

## Migrations

Com o PostgreSQL da infraestrutura local rodando, aplique a migration do worker.

Este worker usa o database exclusivo:

```text
clube_do_album_ranking
```

Para aplicar as migrations pelo Prisma:

```bash
npx prisma migrate dev
```

Se preferir aplicar manualmente pelo Docker, execute as migrations SQL no banco `clube_do_album_ranking`:

```bash
docker exec -i clube-do-album-postgres psql -U clube -d clube_do_album_ranking < prisma/migrations/20260531211500_init_ranking_schema/migration.sql
docker exec -i clube-do-album-postgres psql -U clube -d clube_do_album_ranking < prisma/migrations/20260601020000_add_album_rating_snapshots/migration.sql
```

No PowerShell:

```powershell
Get-Content prisma\migrations\20260531211500_init_ranking_schema\migration.sql | docker exec -i clube-do-album-postgres psql -U clube -d clube_do_album_ranking
Get-Content prisma\migrations\20260601020000_add_album_rating_snapshots\migration.sql | docker exec -i clube-do-album-postgres psql -U clube -d clube_do_album_ranking
```

Para gerar o Prisma Client:

```bash
npx prisma generate
```

## Como rodar localmente

Instale dependencias:

```bash
npm install
```

Inicie o worker:

```bash
npm run dev
```

Build TypeScript:

```bash
npm run build
```

## Endpoints HTTP

### Health check

```http
GET /health
```

Exemplo:

```bash
curl.exe http://localhost:3002/health
```

### Listar ranking

```http
GET /rankings
```

Query params:

```text
limit: quantidade maxima de itens retornados, padrao 20, maximo 100
```

Exemplo:

```bash
curl.exe "http://localhost:3002/rankings?limit=10"
```

### Buscar ranking de um album

```http
GET /rankings/:albumId
```

O parametro aceita o `albumId` interno ou o `spotifyId`, quando o album ja foi importado.

Exemplo:

```bash
curl.exe http://localhost:3002/rankings/uuid-do-album
```

## Eventos consumidos

## Dead Letter Queues

As filas consumidas por este worker usam dead letter para mensagens rejeitadas com `nack(..., false, false)`.

```text
Dead letter exchange: clube-do-album.dead-letter
Tipo: direct
Filas:
  ranking.album-imported.queue.dlq
  ranking.album-rated.queue.dlq
Routing keys:
  ranking.album-imported.queue.dead
  ranking.album-rated.queue.dead
```

Se as filas principais ja existirem no RabbitMQ sem argumentos de dead letter, recrie as filas antes de subir a nova versao do worker.

### ALBUM_IMPORTED

```text
Exchange: clube-do-album.events
Tipo: topic
Fila: ranking.album-imported.queue
Routing key: album.imported
Evento consumido: ALBUM_IMPORTED
```

Payload esperado:

```json
{
  "event": "ALBUM_IMPORTED",
  "albumId": "uuid-do-album",
  "spotifyId": "spotify-id",
  "name": "Abbey Road",
  "artistName": "The Beatles",
  "status": "AVAILABLE",
  "occurredAt": "2026-05-31T18:00:00.000Z"
}
```

### ALBUM_RATED

```text
Exchange: clube-do-album.events
Tipo: topic
Fila: ranking.album-rated.queue
Routing key: album.rated
Evento consumido: ALBUM_RATED
```

Payload esperado:

```json
{
  "event": "ALBUM_RATED",
  "albumId": "uuid-do-album",
  "userId": "uuid-do-usuario",
  "rating": 4.5,
  "occurredAt": "2026-05-31T18:00:00.000Z"
}
```

Ao receber uma avaliacao, o worker salva ou atualiza a nota daquele usuario para aquele album em `album_rating_snapshots`. Depois recalcula:

```text
average_rating
total_ratings
score
position
```

Nesta etapa, `score` usa a propria media das avaliacoes. Em caso de empate, a ordenacao prioriza albuns com mais avaliacoes.

O campo `albumId` do evento deve ser, preferencialmente, o `id` interno do album retornado pela Catalog API. Se for enviado o `spotifyId` de um album ja importado, o worker tambem tenta localizar o ranking pelo campo `spotify_id` e recalcula o registro correto.

## Como testar manualmente

No repositorio de infraestrutura:

```bash
docker compose up -d
```

No `clube-do-album-ranking-worker`:

```bash
npm install
npm run dev
```

Em outro terminal, rode a `clube-do-album-catalog-api` e importe um album:

```http
POST /albums/import
```

Body:

```json
{
  "spotifyId": "spotify-id-aqui"
}
```

O worker deve registrar logs como:

```text
clube-do-album-ranking-worker initialized
Ranking worker started
Waiting for album.imported events...
ALBUM_IMPORTED received for album: Abbey Road
Initial ranking created for albumId: uuid
```

Depois rode a `clube-do-album-ratings-api` e crie uma avaliacao:

```http
POST /ratings
```

Body:

```json
{
  "albumId": "uuid-do-album",
  "userId": "user-1",
  "rating": 4.5
}
```

O worker deve registrar logs como:

```text
ALBUM_RATED received for albumId: uuid-do-album
Ranking recalculated for albumId: uuid-do-album | average: 4.5 | total: 1
```

Depois confirme no banco se existe registro em:

```text
album_rankings
album_rating_snapshots
```

## Docker

Crie um arquivo local de ambiente a partir do exemplo:

```bash
cp .env.example .env
```

Build da imagem:

```bash
docker build -t clube-do-album-ranking-worker .
```

Execucao local:

```bash
docker run --env-file .env clube-do-album-ranking-worker
```

Execucao em container na network local:

```bash
docker run -d --name clube-do-album-ranking-worker \
  --network clube-do-album-network \
  -e SERVER_PORT=3002 \
  -e DATABASE_URL=postgresql://clube:clube@clube-do-album-postgres:5432/clube_do_album_ranking \
  -e RABBITMQ_URL=amqp://clube:clube@clube-do-album-rabbitmq:5672 \
  -e RABBITMQ_EXCHANGE=clube-do-album.events \
  -e RABBITMQ_DEAD_LETTER_EXCHANGE=clube-do-album.dead-letter \
  -e ALBUM_IMPORTED_QUEUE=ranking.album-imported.queue \
  -e ALBUM_IMPORTED_ROUTING_KEY=album.imported \
  -e ALBUM_RATED_QUEUE=ranking.album-rated.queue \
  -e ALBUM_RATED_ROUTING_KEY=album.rated \
  -p 3002:3002 \
  clube-do-album-ranking-worker
```

## Status atual

Worker consome `ALBUM_IMPORTED` e `ALBUM_RATED`. A partir das avaliacoes, mantem snapshots por usuario/album, recalcula o ranking em `album_rankings` e expoe endpoints HTTP para consulta.
