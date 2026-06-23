# TERM-METRO_TORCIDA_GRAFOL-O

Conectar o Termômetro da Torcida ao Grafolão real (Etapa 2)
O dashboard (termometro-dashboard.html) e o módulo torcida-core.mjs usam a mesma lógica (validada: produzem os mesmos números). Para a Etapa 2, você alimenta o torcida-core.mjs com os palpites reais, em vez dos sintéticos.

1. O contrato de entrada
O núcleo só precisa de um array de palpites neste formato (nada de Prisma por dentro — é agnóstico):

palpites = [
  { u: 'usuarioId', g: 'jogoId', casa: 'Brasil', fora: 'Sérvia', gc: 2, gf: 1 },
  // ...
]
u = id do usuário · g = id do jogo · casa/fora = nomes das seleções · gc/gf = gols previstos para casa/fora.

2. O adaptador (Fastify + Prisma → núcleo)
Crie apps/backend/src/modules/torcida/torcida.service.ts. Importe o núcleo (torcida-core.mjs pode ficar em src/modules/torcida/core.mjs; com "allowJs": true no tsconfig o import funciona, ou porte para .ts adicionando tipos):

import prisma from '../../db/prisma.js'
import { pipeline, nmi } from './core.mjs'

// Busca os palpites reais e converte para o contrato do núcleo
async function carregarPalpites() {
  const ps = await prisma.palpite.findMany({
    where: { jogo: { timeCasaId: { not: null }, timeVisitanteId: { not: null } } },
    select: {
      usuarioId: true, golsCasa: true, golsVisitante: true, jogoId: true,
      jogo: { select: { timeCasa: { select: { nome: true } },
                        timeVisitante: { select: { nome: true } } } },
    },
  })
  return ps.map(p => ({
    u: p.usuarioId, g: p.jogoId,
    casa: p.jogo.timeCasa!.nome, fora: p.jogo.timeVisitante!.nome,
    gc: p.golsCasa, gf: p.golsVisitante,
  }))
}

const TIMES_CACHE: { at: number; v: any } = { at: 0, v: null }

export async function calcular(heur = 'H1', tau = 0.5, theta = 0.5) {
  const palpites = await carregarPalpites()
  const times = [...new Set(palpites.flatMap(p => [p.casa, p.fora]))]
  const dados = { times, palpites }
  return pipeline(dados, heur, { tau, theta, kMin: 2 })
}
Os times são derivados dos próprios palpites; se preferir a lista canônica, use prisma.time.findMany().

3. Endpoints
Reaproveite o padrão dos arquivos que já entreguei (torcida.controller.ts, torcida.routes.ts), agora chamando calcular(...). O resultado do pipeline traz tudo que as telas precisam:

Campo	Uso na interface
fav ({usuarioId: time})	tribo de cada usuário → "Minha Tribo"
fanShare ({time: nº})	barras de fan-share
proj.nodes / proj.edges	grafo de tribos (Sigma.js/D3)
lou.comm / lou.Q	comunidades detectadas + modularidade
Z ({u:{t:score}})	vetores de afinidade (aliadas, detalhe)
Para a comparação entre heurísticas (matriz NMI da Seção 8 do artigo), rode o pipeline para H1..H4 e cruze os fav com nmi(favA, favB).

4. Ordem sugerida
Já feito: dashboard sintético rodando (abra o .html).
Troque a fonte de dados: carregarPalpites() em vez de gerarDados().
Exponha 1 endpoint (GET /torcida?heur=H1) e confirme que volta JSON.
Ligue o front (Sigma.js/D3) ao endpoint, reusando o desenho do dashboard.
Acrescente a matriz NMI (E4) e os snapshots por rodada (histórico/bandwagon).
5. Parâmetros (iguais ao dashboard e ao artigo)
kMin=2 (mínimo de jogos por seleção) · tau (limiar de fã, z-score) · theta (limiar de aresta na projeção por cosseno). Comece com tau=0.5, theta=0.5 e ajuste observando densidade e nº de tribos.
