## Problema

Após importar 6 mil+ registros, a aplicação fica muito lenta porque:

1. **DOM gigantesco**: cada linha renderiza ~10 células + tooltips Radix (que criam portals). Com 6k linhas → ~60k+ elementos DOM. O navegador trava em scroll, hover e re-render.
2. **Filtros sem debounce**: cada tecla digitada em `FiltersBar` recalcula `useMemo` sobre os 6k registros e re-renderiza a tabela inteira.
3. **Import em uma única operação**: `addPrices` faz um único `setPrices(cur => [...cur, ...rows])` com 6k itens, o que congela a UI por segundos.
4. **Conversão de moeda repetida**: `convertCurrency()` é chamada inline em cada célula, em cada render.

## Solução

### 1. Virtualização da tabela (impacto maior)
- Adicionar `@tanstack/react-virtual` em `src/components/app/PricesTable.tsx`.
- Renderizar apenas as linhas visíveis na viewport (~30-50 de cada vez) em vez de todas as 6k.
- Manter o agrupamento atual por `partNumber + contract + supplier + dateFrom + dateTo`, virtualizando a lista achatada de "linhas a renderizar" (cabeçalho do grupo + filhos).
- Manter `<thead>` fixo e altura de linha estimada (~44px) para o virtualizador.

### 2. Debounce nos filtros de texto
- Em `src/components/app/FiltersBar.tsx`, manter `value` local controlado e propagar para o pai com 250ms de debounce.
- Os campos de data e número continuam imediatos (são selects/spinners curtos).
- Resultado: digitar "ABC123" no Part Number deixa de disparar 6 re-cálculos sobre 6k linhas.

### 3. Importação em lotes
- Em `src/contexts/DataContext.tsx`, no `addPrices`, quando `rows.length > 500`:
  - Quebrar em lotes de 500.
  - Aplicar com `setTimeout(..., 0)` entre lotes para liberar a thread principal.
  - Mostrar progresso via `toast` ("Importando 1500/6000…").
- Um único log de auditoria no final, não um por lote.

### 4. Substituir tooltips Radix por `title` nativo
- Nas células de preço de `PricesTable.tsx`, trocar `<Tooltip>` (que monta portal por célula) pelo atributo HTML `title`.
- Mantém a informação de moeda original no hover, sem custo de portal.

### 5. Memoizar conversão de moeda
- Pré-calcular preços convertidos uma vez por linha dentro do `useMemo` que monta `filtered`, em vez de chamar `convertCurrency()` em cada render de célula.

## Arquivos afetados

- `src/components/app/PricesTable.tsx` — virtualização + remover tooltips Radix
- `src/components/app/FiltersBar.tsx` — debounce 250ms
- `src/pages/Dashboard.tsx` — pré-computar valores convertidos no `useMemo`
- `src/contexts/DataContext.tsx` — `addPrices` em lotes com progresso
- `package.json` — adicionar `@tanstack/react-virtual`

## Resultado esperado

- Scroll fluido com 10k+ registros.
- Filtros respondem sem travar a digitação.
- Import de 6k linhas conclui em ~1-2s sem congelar a tela.
- Uso de memória do DOM cai de ~60k elementos para ~500.

## Não incluído (pode ficar para depois, se quiser)

- Paginação no servidor — ainda não é necessário porque a virtualização resolve no cliente.
- Índices/busca full-text — só faria sentido acima de ~50k registros.