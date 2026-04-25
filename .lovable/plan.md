Plano para corrigir importação, persistência e GBP como moeda padrão/base.

## O que vou ajustar

1. Importação deve cadastrar contratos automaticamente
- Ao importar `.xlsx`, o app vai extrair todos os `Contract Number` dos preços importados.
- Para cada contrato novo, vai criar um registro em Administração → Contracts.
- A moeda padrão desses contratos será sempre `GBP`.
- Se a planilha tiver uma aba `contracts`, ela poderá ser lida, mas contratos sem moeda válida também ficarão como `GBP`.

2. Corrigir persistência no banco
- O fluxo atual chama a API apenas para prices; os contratos derivados da importação não são enviados para o backend.
- Vou atualizar o backend para que `POST /api/prices?source=import` faça tudo dentro da mesma transação:
  - cria automaticamente contratos inexistentes em `contracts`;
  - grava os preços em `prices`;
  - usa `GBP` como moeda padrão quando a linha não tiver moeda válida;
  - evita duplicidade de contratos com `INSERT OR IGNORE`.
- No frontend, após importar, vou recarregar `prices`, `contracts` e `rates`, não apenas `prices`, para a tela refletir exatamente o que ficou salvo no SQLite.
- Também vou melhorar as mensagens de erro/sucesso: não mostrar sucesso antes da API terminar quando estiver em modo banco.

3. Base currency sempre será GBP
- Alterar padrões no frontend:
  - `defaultRates.base = "GBP"`;
  - valores padrão coerentes com GBP como base.
- Alterar padrões no SQLite:
  - `contracts.currency DEFAULT 'GBP'`;
  - `prices.currency DEFAULT 'GBP'`;
  - seed inicial de `exchange_rates` com `GBP` como `is_base = 1`.
- Alterar API de rates para garantir que, mesmo se vier algo diferente, a base efetiva seja `GBP`.
- Ajustar tela de Administração para novo contrato iniciar com `GBP`.
- Ajustar import/export/parsing para usar `GBP` como fallback em vez de `USD`.

4. Orientação sobre deploy e comandos no servidor
- Vou atualizar a documentação e os comentários do `docker-stack.yml` para deixar claro:
  - A cada deploy normal não deve ser necessário rodar comando manual para schema; `ensureSchema()` roda automaticamente na inicialização da API.
  - O comando de seed de usuários só é necessário uma vez no primeiro deploy, ou se quiser recriar/alterar usuários iniciais.
  - Se estiver usando tag `latest`, em Portainer normalmente precisa fazer “Pull and redeploy” para baixar a nova imagem.
  - O volume `price_data` precisa continuar o mesmo; se ele for removido/trocado, os dados somem.

## Detalhes técnicos

Arquivos principais que serão alterados:
- `src/lib/types.ts`: ordenar/assumir GBP como moeda padrão quando aplicável.
- `src/lib/xlsx-io.ts`: fallback de Currency e Rates para GBP.
- `src/contexts/DataContext.tsx`: reload completo após importação e defaults GBP.
- `src/pages/Dashboard.tsx`: tratar importação como operação assíncrona e só exibir sucesso após persistência.
- `src/pages/Admin.tsx`: novo contrato e rates com base GBP.
- `server/sql/schema.sql`: defaults e seed de moedas para GBP.
- `server/src/migrate.js`: migração idempotente para bancos existentes, garantindo defaults e base GBP sem apagar dados.
- `server/src/routes/prices.js`: criar contratos automaticamente durante import/create de preços.
- `server/src/routes/contracts.js`: fallback/default GBP no create/update.
- `server/src/routes/rates.js`: forçar base GBP.
- `DEPLOYMENT.md`, `server/README.md`, `docker-stack.yml`: explicar deploy, seed e persistência do volume.

## Observação importante sobre o bug “não persiste”

Se no ambiente de produção o frontend foi buildado sem `VITE_API_URL`, ou se a API está inacessível/CORS bloqueado, o app cai no modo local `.xlsx` e nada vai persistir no banco. Além da correção no código, vou deixar isso mais explícito na documentação. Para produção, o build precisa ter:

```text
VITE_API_URL=https://price-api.webtorres.com.br
```

E a API precisa responder em:

```text
/api/health
```

com o volume Docker persistente montado em `/data`.