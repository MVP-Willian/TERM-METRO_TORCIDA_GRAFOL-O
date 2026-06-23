// ============================================================================
//  NÚCLEO DO "TERMÔMETRO DA TORCIDA" — framework-agnóstico (Node e navegador)
//  Implementa: dados sintéticos, 4 heurísticas, normalização z-score,
//  grafo bipartido, projeção por cosseno, Louvain e NMI.
// ============================================================================

export function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}

// ---- 1. Geração de dados sintéticos --------------------------------------
export function gerarDados({seed=7, nParticipantes=50}={}){
  const rng = mulberry32(seed);
  const rnd = (a,b)=>a+(b-a)*rng();
  const ri  = (a,b)=>Math.floor(rnd(a,b+1));
  const times = [
    {nome:'Brasil',forca:2.3},{nome:'Argentina',forca:2.1},{nome:'França',forca:2.0},{nome:'Espanha',forca:1.9},
    {nome:'Croácia',forca:1.5},{nome:'México',forca:1.4},{nome:'Japão',forca:1.3},
    {nome:'Sérvia',forca:1.0},{nome:'Camarões',forca:0.9},
  ];
  const forcaDe = Object.fromEntries(times.map(t=>[t.nome,t.forca]));
  // round-robin completo
  const jogos=[]; let gid=0;
  for(let i=0;i<times.length;i++)for(let j=i+1;j<times.length;j++)
    jogos.push({id:'g'+(gid++),casa:times[i].nome,fora:times[j].nome});
  // tipos de torcedor
  const tipos=['leal','zebra','otimista','favorito_forte','neutro'];
  const pesoTipo=[0.40,0.15,0.15,0.15,0.15];
  const escolheTipo=()=>{let r=rng(),acc=0;for(let k=0;k<tipos.length;k++){acc+=pesoTipo[k];if(r<=acc)return tipos[k];}return 'neutro';};
  const fortes=times.filter(t=>t.forca>=1.9).map(t=>t.nome);
  const fracas=times.filter(t=>t.forca<=1.5).map(t=>t.nome);
  const participantes=[]; const palpites=[];
  for(let p=0;p<nParticipantes;p++){
    const id='P'+String(p+1).padStart(3,'0');
    const tipo=escolheTipo();
    let fav=null;
    if(tipo==='zebra') fav=fracas[ri(0,fracas.length-1)];
    else if(tipo==='favorito_forte') fav=fortes[ri(0,fortes.length-1)];
    else if(tipo==='leal') fav=times[ri(0,times.length-1)].nome;
    participantes.push({id,tipoOculto:tipo,favOculto:fav});
    for(const j of jogos){
      if(rng()>0.9) continue; // ~10% não palpitam o jogo
      let gc=forcaDe[j.casa]+rnd(-0.4,0.4);
      let gf=forcaDe[j.fora]+rnd(-0.4,0.4);
      const boost=tipo==='zebra'?2.2:1.8;
      if(fav){ if(j.casa===fav) gc+=boost; if(j.fora===fav) gf+=boost; }
      if(tipo==='otimista'){ gc+=1.0; gf+=1.0; }
      gc=Math.max(0,Math.round(gc)); gf=Math.max(0,Math.round(gf));
      palpites.push({u:id,g:j.id,casa:j.casa,fora:j.fora,gc,gf});
    }
  }
  return {times:times.map(t=>t.nome), jogos, participantes, palpites};
}

// ---- 2. Agregações coletivas: mu(t,g) e Pder(t,g) -------------------------
export function agregados(palpites){
  const soma={}, cnt={}, derrota={};
  const add=(o,k,v)=>{o[k]=(o[k]||0)+v;};
  for(const p of palpites){
    const mc=p.gc-p.gf; // margem casa
    add(soma,p.g+'|'+p.casa, mc);  add(cnt,p.g+'|'+p.casa,1);
    add(soma,p.g+'|'+p.fora,-mc);  add(cnt,p.g+'|'+p.fora,1);
    if(mc<=0) add(derrota,p.g+'|'+p.casa,1); // casa não venceu
    if(-mc<=0)add(derrota,p.g+'|'+p.fora,1); // fora não venceu
  }
  const mu={}, pder={};
  for(const k in cnt){ mu[k]=soma[k]/cnt[k]; pder[k]=(derrota[k]||0)/cnt[k]; }
  return {mu,pder,cnt};
}

// ---- 3. As quatro heurísticas (peso bruto por (u,t)) ----------------------
export function heuristicas(palpites, {mu,pder}, kMin=2){
  // coleta por (u,t)
  const acc={}; // u -> t -> {margens:[], gols:[], vit:[], pderVit:[]}
  const get=(u,t)=>{ (acc[u]=acc[u]||{})[t]=acc[u][t]||{m:[],gols:[],vit:[],risco:0}; return acc[u][t]; };
  for(const p of palpites){
    const mc=p.gc-p.gf;
    // time da casa
    let r=get(p.u,p.casa); r.m.push(mc); r.gols.push(p.gc); r.vit.push(mc>0?1:0); if(mc>0) r.risco+=pder[p.g+'|'+p.casa]||0;
    // time visitante
    r=get(p.u,p.fora); r.m.push(-mc); r.gols.push(p.gf); r.vit.push(-mc>0?1:0); if(-mc>0) r.risco+=pder[p.g+'|'+p.fora]||0;
  }
  const W={H1:{},H2:{},H3:{},H4:{}};
  for(const u in acc){
    for(const t in acc[u]){
      const r=acc[u][t]; const n=r.m.length; if(n<kMin) continue;
      // H1: média do viés (m - mu)  — precisa mu por jogo; recomputo via média de m menos média de mu
      // viés médio = média(m) - média(mu correspondente). Como guardei só m, refaço abaixo.
      // (mais simples: somo (m_g - mu_g) por jogo)
      (W.H1[u]=W.H1[u]||{}); (W.H2[u]=W.H2[u]||{}); (W.H3[u]=W.H3[u]||{}); (W.H4[u]=W.H4[u]||{});
      const meanGols=r.gols.reduce((a,b)=>a+b,0)/n;
      const freqVit=r.vit.reduce((a,b)=>a+b,0)/n;
      W.H2[u][t]=meanGols;
      W.H3[u][t]=freqVit;
      W.H4[u][t]=r.risco; // soma de vit*pder
    }
  }
  // H1 precisa do mu por jogo: recomputa numa passada dedicada
  const h1soma={}, h1cnt={};
  for(const p of palpites){
    const mc=p.gc-p.gf;
    const bc=mc-(mu[p.g+'|'+p.casa]||0);
    const bf=(-mc)-(mu[p.g+'|'+p.fora]||0);
    h1soma[p.u+'|'+p.casa]=(h1soma[p.u+'|'+p.casa]||0)+bc; h1cnt[p.u+'|'+p.casa]=(h1cnt[p.u+'|'+p.casa]||0)+1;
    h1soma[p.u+'|'+p.fora]=(h1soma[p.u+'|'+p.fora]||0)+bf; h1cnt[p.u+'|'+p.fora]=(h1cnt[p.u+'|'+p.fora]||0)+1;
  }
  for(const key in h1cnt){ const [u,t]=key.split('|'); if(h1cnt[key]<kMin) continue; (W.H1[u]=W.H1[u]||{})[t]=h1soma[key]/h1cnt[key]; }
  return W;
}

// ---- 4. Normalização z-score por coluna (seleção) -------------------------
export function normalizaPorTime(Wh, times){
  const Z={};
  for(const t of times){
    const vals=[]; for(const u in Wh){ if(Wh[u][t]!==undefined) vals.push([u,Wh[u][t]]); }
    if(vals.length===0) continue;
    const m=vals.reduce((a,[,v])=>a+v,0)/vals.length;
    const sd=Math.sqrt(vals.reduce((a,[,v])=>a+(v-m)**2,0)/vals.length)||1;
    for(const [u,v] of vals){ (Z[u]=Z[u]||{})[t]=(v-m)/sd; }
  }
  return Z;
}

// ---- 5. Favorito (argmax) e fan-share -------------------------------------
export function favoritos(Z, tau=0.5){
  const fav={};
  for(const u in Z){ let bt=null,bv=-Infinity; for(const t in Z[u]){ if(Z[u][t]>bv){bv=Z[u][t];bt=t;} } fav[u]= bv>=tau? bt : null; }
  return fav;
}
export function fanShare(fav, times){ const c=Object.fromEntries(times.map(t=>[t,0])); for(const u in fav){ if(fav[u]) c[fav[u]]++; } return c; }

// ---- 6. Vetores de afinidade + projeção por cosseno -----------------------
export function vetores(Z, times){ const V={}; for(const u in Z){ V[u]=times.map(t=>Z[u][t]||0);} return V; }
function cos(a,b){ let d=0,na=0,nb=0; for(let i=0;i<a.length;i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];} return (na&&nb)?d/Math.sqrt(na*nb):0; }
export function projecao(V, theta=0.5){
  const us=Object.keys(V); const edges=[];
  for(let i=0;i<us.length;i++)for(let j=i+1;j<us.length;j++){ const s=cos(V[us[i]],V[us[j]]); if(s>theta) edges.push({source:us[i],target:us[j],weight:s}); }
  return {nodes:us, edges};
}

// ---- 7. Louvain (modularidade) --------------------------------------------
export function louvain(nodes, edges){
  // adjacência ponderada
  const adj=new Map(); nodes.forEach(n=>adj.set(n,new Map()));
  let m2=0; // 2m
  for(const e of edges){ adj.get(e.source).set(e.target,(adj.get(e.source).get(e.target)||0)+e.weight); adj.get(e.target).set(e.source,(adj.get(e.target).get(e.source)||0)+e.weight); m2+=2*e.weight; }
  if(m2===0){ const comm={}; nodes.forEach((n,i)=>comm[n]=i); return {comm,Q:0}; }
  const k=new Map(); for(const n of nodes){ let s=0; for(const [,w] of adj.get(n)) s+=w; k.set(n,s); }
  let comm=new Map(); nodes.forEach(n=>comm.set(n,n));
  const sigma=new Map(); nodes.forEach(n=>sigma.set(n,k.get(n))); // soma de graus por comunidade
  let improved=true, passes=0;
  while(improved && passes<20){
    improved=false; passes++;
    for(const n of nodes){
      const cn=comm.get(n); sigma.set(cn,sigma.get(cn)-k.get(n));
      // ganho por comunidade vizinha
      const wTo=new Map(); for(const [nb,w] of adj.get(n)){ const c=comm.get(nb); wTo.set(c,(wTo.get(c)||0)+w); }
      let best=cn, bestGain=0;
      for(const [c,wic] of wTo){ const gain=wic - k.get(n)*sigma.get(c)/m2; if(gain>bestGain){bestGain=gain;best=c;} }
      // considera ficar (gain 0) vs mover
      const stayGain=(wTo.get(cn)||0) - k.get(n)*sigma.get(cn)/m2;
      if(bestGain>stayGain+1e-12 && best!==cn){ comm.set(n,best); sigma.set(best,sigma.get(best)+k.get(n)); improved=true; }
      else { comm.set(n,cn); sigma.set(cn,sigma.get(cn)+k.get(n)); }
    }
  }
  // modularidade final
  let Q=0;
  for(const e of edges){ if(comm.get(e.source)===comm.get(e.target)) Q+=2*e.weight; }
  // subtrai esperado
  const sig=new Map(); for(const n of nodes){ const c=comm.get(n); sig.set(c,(sig.get(c)||0)+k.get(n)); }
  let expct=0; for(const [,s] of sig) expct+=s*s; 
  Q = Q/m2 - expct/(m2*m2);
  // renumera comunidades 0..K
  const ids=[...new Set([...comm.values()])]; const map=Object.fromEntries(ids.map((c,i)=>[c,i]));
  const out={}; for(const [n,c] of comm) out[n]=map[c];
  return {comm:out, Q, nComunidades:ids.length};
}

// ---- 8. NMI entre dois rotulamentos ---------------------------------------
export function nmi(A,B){
  const keys=Object.keys(A).filter(k=>B[k]!==undefined && A[k]!=null && B[k]!=null);
  const n=keys.length; if(n===0) return 1;
  const cA={},cB={},cAB={};
  for(const k of keys){ cA[A[k]]=(cA[A[k]]||0)+1; cB[B[k]]=(cB[B[k]]||0)+1; const j=A[k]+'~'+B[k]; cAB[j]=(cAB[j]||0)+1; }
  const H=c=>{let h=0;for(const x in c){const p=c[x]/n;h-=p*Math.log(p);}return h;};
  let MI=0; for(const j in cAB){ const [a,b]=j.split('~'); const p=cAB[j]/n; MI+=p*Math.log(p/((cA[a]/n)*(cB[b]/n))); }
  const ha=H(cA),hb=H(cB); return (ha>0&&hb>0)?MI/Math.sqrt(ha*hb):1;
}

// ---- pipeline completo de uma heurística ----------------------------------
export function pipeline(dados, heurKey, {tau=0.5, theta=0.5, kMin=2}={}){
  const ag=agregados(dados.palpites);
  const W=heuristicas(dados.palpites, ag, kMin);
  const Z=normalizaPorTime(W[heurKey], dados.times);
  const fav=favoritos(Z, tau);
  const V=vetores(Z, dados.times);
  const proj=projecao(V, theta);
  const lou=louvain(proj.nodes, proj.edges);
  return {ag,W,Z,fav,V,proj,lou, fanShare:fanShare(fav,dados.times)};
}

// ---- 9. Grau bipartido: nº de seleções com afinidade >= tau por usuário ----
export function grauBipartido(Z, tau=0.5){
  const grau={}; for(const u in Z){ let g=0; for(const t in Z[u]) if(Z[u][t]>=tau) g++; grau[u]=g; }
  // histograma
  const hist={}; for(const u in grau){ hist[grau[u]]=(hist[grau[u]]||0)+1; }
  const mean=Object.values(grau).reduce((a,b)=>a+b,0)/(Object.keys(grau).length||1);
  return {grau,hist,mean};
}
