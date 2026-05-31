# Clube do Album Ranking Worker

Worker responsavel pelo futuro processamento de rankings da plataforma Clube do Album.

## Responsabilidade futura

- Consumir eventos do RabbitMQ.
- Recalcular rankings.
- Gerar ranking geral.
- Gerar ranking dos usuarios seguidos.
- Detectar albuns em alta.

## Tecnologias usadas

- Node.js
- TypeScript

## Como rodar localmente

```bash
npm install
npm run dev
```

Status atual: projeto inicial criado apenas com estrutura base. As funcionalidades serão implementadas nas próximas etapas.
