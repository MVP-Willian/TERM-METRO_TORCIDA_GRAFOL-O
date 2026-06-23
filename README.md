# ⚽ Termômetro da Torcida — Copa do Mundo 2026

Dashboard interativo de análise de bolão. A partir dos palpites de **135 participantes** em **33 jogos**, o sistema infere automaticamente a **seleção do coração** de cada pessoa e as agrupa em **tribos**, revelando padrões de torcida escondidos nos dados.

---

## 🚀 Como usar

O dashboard é um único arquivo HTML autocontido — sem servidor, sem dependências externas além de D3.js (carregado via CDN).

1. Faça o download de `termometro-copa2026.html`
2. Abra o arquivo diretamente no navegador (Chrome, Firefox ou Edge recomendados)
3. Pronto. Tudo roda localmente no seu browser

---

## 📐 Estrutura do arquivo

```
termometro-copa2026.html
├── Dados embutidos (JSON inline no <script>)
│   ├── PALPITES_RAW   — todos os palpites (usuário, jogo, placar, pontos)
│   ├── JOGOS_RAW      — jogos com resultado real
│   └── PARTICIPANTES_RAW — lista de participantes
├── Motor analítico (JavaScript puro)
│   ├── agregados()    — calcula μ (média da multidão) e P_der por jogo/time
│   ├── heuristicas()  — computa os 4 pesos W por (usuário × seleção)
│   ├── normaliza()    — transforma W em z-scores por seleção
│   ├── favoritos()    — identifica a seleção do coração via limiar τ
│   ├── projecao()     — grafo de co-torcida por similaridade de cosseno
│   └── louvain()      — detecção de comunidades (tribos)
└── Visualizações (D3.js + HTML/CSS)
    ├── Aba Tribos
    ├── Aba Ranking
    ├── Aba Jogos
    └── Aba Palpites da Tribo  ← nova
```

---

## 🗂️ Abas do dashboard

### 🔴 Tribos

A aba principal. Mostra a **rede de co-torcida** entre os participantes.

**Como funciona o pipeline:**

```
palpite → margem m = gc − gf
        → agregados da multidão (μ, P_der)
        → peso W por heurística
        → z-score por seleção (Z)
        → grafo bipartido (fã × seleção) com limiar τ
        → projeção por cosseno com limiar θ
        → Louvain → tribos
```

**Controles disponíveis:**

| Controle | O que faz |
|---|---|
| **H1 Viés Relativo** | Quanto cada pessoa é mais otimista que a média da multidão para cada seleção. Melhor para capturar fãs de times "underdogs" |
| **H2 Otimismo Absoluto** | Média de gols previstos a favor. Tende a saturar o grafo com seleções ofensivas |
| **H3 Confiança de Vitória** | Fração de jogos em que apostou na vitória. Mede consistência de fé |
| **H4 Fator Zebra** | Vitórias previstas ponderadas pelo risco histórico do adversário. Recompensa fidelidade na adversidade — grafos mais esparsos e coesos |
| **τ (limiar de fã)** | Define o z-score mínimo para considerar alguém "fã" de uma seleção. Valores maiores = tribos menores e mais convictas |
| **θ (limiar de aresta)** | Similaridade mínima de cosseno para conectar dois participantes no grafo. Valores maiores = rede mais esparsa |

**Dois modos de visualização:**

- **Rede de tribos** — nós são participantes, coloridos pela seleção favorita, arestas indicam co-torcida similar
- **Bipartido fã × seleção** — participantes à esquerda, seleções à direita, linhas mostram as conexões acima do limiar τ

**Painéis laterais:**

- **Placar topológico** — Modularidade Q (quanto as tribos são separadas), número de comunidades Louvain, grau bipartido médio e total de arestas
- **Fan-share** — quantos fãs cada seleção tem segundo a heurística ativa
- **Concordância NMI** — matriz de similaridade entre as 4 heurísticas. Valores próximos de 1.00 significam que as duas lentes enxergam as mesmas tribos

---

### 🏆 Ranking

Tabela completa dos 135 participantes ordenada por pontos totais.

| Coluna | Significado |
|---|---|
| **#** | Posição no ranking geral |
| **Participante** | Nome/código do palpiteiro |
| **Tribo (H1)** | Seleção do coração inferida pela heurística H1 |
| **Acertos placar** | Quantas vezes acertou o placar exato (10 pts cada) |
| **Acertos venc.** | Quantas vezes acertou o vencedor sem o placar (5–7 pts) |
| **Erros** | Palpites completamente errados (0 pts) |
| **Pts** | Pontuação total |

À direita há três painéis adicionais:

- **Distribuição de pontos** — histograma mostrando como os pontos se distribuem entre todos os participantes
- **Tipos de acerto (geral)** — proporção global de acertos de placar, acertos de vencedor e erros
- **Pontos médios por tribo (H1)** — qual tribo tem a melhor performance média no bolão

Use o campo de busca para filtrar participantes pelo nome.

---

### 📋 Jogos

Lista de todos os 33 jogos com resultado real, grupo, rodada e estatísticas de palpites.

Para cada jogo são exibidos:
- Times (casa vs fora) com cores da seleção
- Placar real
- Vencedor do jogo
- Total de palpites recebidos e quantos acertaram o placar exato

Filtre por grupo usando os botões no topo da aba.

---

### 🎯 Palpites da Tribo *(nova aba)*

A funcionalidade pedida: **ver os palpites de todos os membros de uma tribo, filtrados pela seleção que os une**.

**Como usar:**

1. Clique em uma das seleções/tribos no topo (ordenadas por tamanho)
2. O sistema mostra todos os jogos onde pelo menos um membro da tribo fez palpite
3. Jogos com ⚽ são aqueles em que a própria seleção da tribo jogou
4. Clique em qualquer jogo para expandir e ver os palpites individuais

**O que cada card mostra:**

| Cor da borda | Significado |
|---|---|
| 🟢 Verde | Acerto de placar (10 pts) |
| 🟡 Âmbar | Acerto de vencedor (5–7 pts) |
| Cinza escuro | Erro (0 pts) |

**Para análise de concordância dentro da tribo:**

- Veja o **palpite mais comum** do grupo no cabeçalho de cada jogo — isso mostra o "consenso da tribo"
- Compare os cards lado a lado para identificar quem pensou igual a quem
- Jogos com muitos verdes indicam jogos onde a tribo se saiu bem coletivamente
- Quando o palpite mais comum não é o acerto, a tribo errou junto — viés coletivo claro

---

## 🔬 Como interpretar os resultados

### Modularidade Q

- **Q > 0.3** → estrutura de tribos bem definida; as pessoas realmente se agrupam por torcida
- **Q < 0.1** → tribos fracas; os palpites não revelam preferências consistentes
- H4 (Fator Zebra) tende a produzir Q mais alto porque é seletivo

### NMI entre heurísticas

- **NMI ≈ 1.0** → as duas heurísticas identificam as mesmas tribos
- **NMI < 0.5** → as heurísticas enxergam torcidas diferentes — vale explorar qual faz mais sentido para o seu grupo

### Fan-share vs Tribos Louvain

- **Fan-share** conta quantas pessoas têm aquela seleção como favorita (pode ter empates)
- **Tribos Louvain** são grupos de pessoas com *padrões de palpite similares* — podem conter fãs de seleções diferentes mas com estilo de torcida parecido

### Grau bipartido médio

- **Alto (H2)** → cada participante tem conexão com muitas seleções; dificulta a separação em tribos
- **Baixo (H4)** → cada participante tem conexões focadas; tribos mais nítidas

---

## 📊 Sistema de pontuação do bolão

| Resultado | Pontos |
|---|---|
| Placar exato | 10 pts |
| Vencedor correto + diferença de gols correta | 7 pts |
| Vencedor correto | 5 pts |
| Empate previsto e ocorreu | 7 pts (acerto_vencedor) |
| Erro | 0 pts |

---

## 🛠️ Tecnologias

- **D3.js v7** — força de simulação para o grafo e histograma
- **Algoritmo de Louvain** — detecção de comunidades em grafos ponderados (implementação própria em JS)
- **Similaridade de cosseno** — projeção do grafo bipartido
- **Z-score por seleção** — normalização que corrige diferenças de popularidade entre seleções
- HTML/CSS/JS puro — zero frameworks, zero build step

---

## 📁 Atualização dos dados

Os dados estão embutidos diretamente no HTML como constantes JavaScript:

```javascript
const PALPITES_RAW = [...];   // array de palpites
const JOGOS_RAW = [...];      // array de jogos com resultados
const PARTICIPANTES_RAW = [...]; // array de participantes
```

Para atualizar com novos jogos, basta substituir esses arrays e reabrir o arquivo no browser.

---

*Dashboard gerado para o bolão da Copa do Mundo 2026 · 135 participantes · 33 jogos · 1 113 palpites*
