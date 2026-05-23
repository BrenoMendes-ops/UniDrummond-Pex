# Projeto Pex

Servidor de agendamento para salão de beleza/cabeleireiro com MongoDB.

## Recursos implementados
- Cadastro de profissionais, clientes e serviços
- Exibição de disponibilidade de horários por profissional e serviço
- Agendamento com preço automático e registro de ofertas/combo
- Cancelamento rápido de compromissos
- Notificações de lembrete para clientes
- Visualização de preços e promoções

## Variáveis de ambiente
- `MONGODB_URI`: string de conexão com o MongoDB (veja `.env.example`).

## Scripts úteis
- `npm start` — inicia o servidor
- `npm run dev` — inicia o servidor com `nodemon` (se instalado)
- `npm run seed` — popula o banco com dados de exemplo

## Seed
1. Copie `.env.example` para `.env` e ajuste `MONGODB_URI` se necessário.
2. Execute:

```bash
npm install
npm run seed
```

Isso irá limpar as coleções e inserir profissionais, clientes, serviços, ofertas e agendamentos de teste.

## Endpoints principais
- `GET /professionals`
- `POST /professionals`
- `GET /clients`
- `POST /clients`
- `GET /services`
- `POST /services`
- `GET /offers`
- `POST /offers`
- `GET /appointments`
- `POST /appointments`
- `PATCH /appointments/:id/cancel`
- `GET /availability?professionalId=<id>&serviceId=<id>&date=YYYY-MM-DD`
- `GET /notifications/due?hours=24`
- `POST /notifications/send?hours=24`
