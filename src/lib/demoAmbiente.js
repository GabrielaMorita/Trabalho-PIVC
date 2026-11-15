// Dados FICTÍCIOS de demonstração do ambiente (não representam medições reais).
// Os ids são fixos: carregar de novo atualiza os mesmos documentos em vez de duplicar.
const DAY = 86400000;

function rng(seed) { let s = seed; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function lastMonths(n) {
  const d = new Date(); d.setDate(1);
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${MONTHS[x.getMonth()]}/${String(x.getFullYear()).slice(2)}`); }
  return out;
}
const series = (base, vals) => lastMonths(vals.length).map((periodo, i) => ({ periodo, valor: +(base * vals[i]).toFixed(1) }));

export function demoAmbiente() {
  const now = Date.now();
  const r = rng(42);
  const out = [];

  [
    ['Risco extremo de incêndio no arco sul da Amazônia', 'alta', 'Pará e Mato Grosso', 'Baixa umidade relativa e vento seco elevam o risco de propagação do fogo nos próximos dias.', 1],
    ['Qualidade do ar piora em área metropolitana', 'media', 'Sudeste', 'Concentração de material particulado acima do recomendado nas horas de pico de tráfego.', 3],
    ['Turbidez elevada em trecho de rio', 'media', 'Bacia do Alto Tocantins', 'Chuva forte carregou sedimentos e aumentou a turbidez após a captação.', 5],
    ['Nível de reservatório em queda', 'alta', 'Minas Gerais', 'Período seco prolongado reduz o volume armazenado e a diluição de poluentes.', 8],
  ].forEach(([titulo, severidade, regiao, descricao, d], i) => out.push({ id: `demo-alerta-${i}`, tipo: 'alerta', titulo, severidade, regiao, descricao, data: now - d * DAY, demo: true }));

  const clusters = [
    ['queimada', -6.5, -52.0, 'Pará', 14], ['queimada', -12.0, -55.5, 'Mato Grosso', 12], ['queimada', -9.5, -47.5, 'Tocantins', 8],
    ['desmatamento', -8.5, -63.0, 'Rondônia', 10], ['desmatamento', -5.0, -57.0, 'Pará', 7], ['desmatamento', -9.0, -68.5, 'Acre', 4],
    ['poluicao', -23.5, -46.6, 'São Paulo', 4], ['poluicao', -22.9, -43.2, 'Rio de Janeiro', 3], ['poluicao', -3.1, -60.0, 'Amazonas', 2],
  ];
  let k = 0;
  clusters.forEach(([categoria, lat, lon, regiao, n]) => {
    for (let i = 0; i < n; i++) {
      out.push({ id: `demo-ocorrencia-${k++}`, tipo: 'ocorrencia', categoria, lat: +(lat + (r() - 0.5) * 4).toFixed(2), lon: +(lon + (r() - 0.5) * 4).toFixed(2), regiao, data: now - Math.floor(r() * 20) * DAY, intensidade: Math.ceil(r() * 5), demo: true });
    }
  });

  [
    ['Rio Negro', 'Manaus (AM)', 'boa', 6.8, 6.9, 12], ['Rio Tietê', 'Grande São Paulo (SP)', 'ruim', 6.4, 1.8, 74],
    ['Lago Paranoá', 'Brasília (DF)', 'boa', 7.4, 7.2, 8], ['Reservatório de Furnas', 'Alfenas (MG)', 'regular', 7.9, 5.1, 22],
    ['Rio Guaíba', 'Porto Alegre (RS)', 'regular', 7.1, 4.6, 31], ['Rio São Francisco', 'Petrolina (PE)', 'boa', 7.3, 6.5, 15],
  ].forEach(([corpo, local, classe, ph, oxigenio, turbidez], i) => out.push({ id: `demo-agua-${i}`, tipo: 'agua', corpo, local, classe, ph, oxigenio, turbidez, data: now - (i + 1) * DAY, demo: true }));

  out.push(
    { id: 'demo-ind-desmat', tipo: 'indicador', nome: 'Área desmatada na Amazônia', unidade: 'km²', historico: series(100, [0.9, 0.8, 0.85, 1.0, 1.2, 1.3, 1.25, 1.1, 1.0, 0.95, 0.9, 0.85]), demo: true },
    { id: 'demo-ind-focos', tipo: 'indicador', nome: 'Focos de queimadas', unidade: 'focos', historico: series(1000, [0.5, 0.6, 0.7, 0.9, 1.4, 2.2, 3.1, 4.0, 3.4, 2.3, 1.6, 1.2]), demo: true },
    { id: 'demo-ind-co2', tipo: 'indicador', nome: 'Emissões de CO₂ estimadas', unidade: 'Mt', historico: series(10, [1.0, 1.02, 1.05, 1.04, 1.08, 1.1, 1.12, 1.15, 1.13, 1.1, 1.08, 1.06]), demo: true },
    { id: 'demo-ind-ar', tipo: 'indicador', nome: 'Índice médio de qualidade do ar', unidade: 'AQI', historico: series(50, [0.8, 0.8, 0.9, 0.9, 1.0, 1.1, 1.2, 1.4, 1.3, 1.1, 1.0, 0.9]), demo: true },
  );

  [
    ['Mercúrio', 'Metal pesado', ['água', 'sedimentos', 'peixes'], ['espectrometria de absorção atômica por vapor frio'], 'Neurotóxico e bioacumulativo: acumula em peixes e atinge comunidades que dependem deles.', 'alta'],
    ['Chumbo', 'Metal pesado', ['solo', 'poeira', 'água de tubulações antigas'], ['espectrometria de massa com plasma indutivamente acoplado (ICP-MS)'], 'Afeta o desenvolvimento neurológico, principalmente de crianças, mesmo em baixas concentrações.', 'alta'],
    ['Cádmio', 'Metal pesado', ['solo', 'água', 'alimentos'], ['espectrometria de absorção atômica', 'ICP-MS'], 'Acumula nos rins e nos ossos; exposição prolongada compromete a função renal.', 'media'],
    ['Organofosforados', 'Agrotóxico', ['água', 'solo', 'alimentos'], ['cromatografia com espectrometria de massas'], 'Inibem enzimas do sistema nervoso e afetam trabalhadores rurais, fauna aquática e polinizadores.', 'alta'],
    ['Microcistinas', 'Cianotoxina', ['reservatórios', 'lagos'], ['imunoensaio (ELISA)', 'cromatografia líquida'], 'Produzidas em florações de cianobactérias; danificam o fígado e inviabilizam o uso da água.', 'alta'],
    ['Aflatoxinas', 'Micotoxina', ['grãos', 'amendoim', 'armazenamento úmido'], ['cromatografia líquida', 'imunoensaio'], 'Contaminam alimentos mal armazenados; associadas a dano hepático e câncer de fígado.', 'alta'],
    ['Hidrocarbonetos policíclicos aromáticos', 'Poluente orgânico', ['ar', 'solo', 'águas costeiras'], ['cromatografia gasosa com espectrometria de massas'], 'Originados da queima incompleta e de derramamentos de petróleo; vários são carcinogênicos.', 'media'],
  ].forEach(([nome, classe, ocorreEm, metodosDeteccao, impactos, gravidade], i) => out.push({ id: `demo-cont-${i}`, tipo: 'contaminante', nome, classe, ocorreEm, metodosDeteccao, impactos, gravidade, demo: true }));

  [
    ['Rompimento de barragem de rejeitos', 'Bacia do Rio Doce', 2, 5, 'Monitorar estruturas, manter plano de evacuação e sistemas de alerta nas comunidades a jusante.'],
    ['Floração de cianobactérias em reservatório de abastecimento', 'Sudeste', 4, 4, 'Monitorar cianotoxinas, ajustar o tratamento e avisar a população em caso de alerta.'],
    ['Derramamento de óleo em águas costeiras', 'Litoral Nordeste', 2, 4, 'Manter barreiras de contenção, equipes treinadas e comunicação rápida com a defesa civil.'],
    ['Contaminação de solo por resíduos industriais', 'Região metropolitana', 3, 3, 'Fiscalizar disposição de resíduos e exigir monitoramento de águas subterrâneas.'],
    ['Uso excessivo de agrotóxicos próximo a nascentes', 'Cerrado', 4, 3, 'Reforçar faixas de proteção e inspeções e acompanhar resíduos na água.'],
    ['Falha no armazenamento de grãos com umidade alta', 'Centro-Oeste', 3, 2, 'Controlar umidade e temperatura e testar lotes antes da distribuição.'],
  ].forEach(([cenario, local, probabilidade, severidade, medidas], i) => out.push({ id: `demo-risco-${i}`, tipo: 'risco', cenario, local, probabilidade, severidade, medidas, demo: true }));

  [
    ['Panorama trimestral da qualidade da água', 'Resumo das medições em seis corpos d’água monitorados, com destaque para trechos urbanos.', 'Equipe de Monitoramento', ['água', 'trimestral'], 12],
    ['Análise de focos de calor e pressão sobre a vegetação', 'Relaciona a distribuição dos focos de queimadas com áreas recentes de desmatamento.', 'Divisão Científica', ['queimadas', 'desmatamento'], 20],
    ['Avaliação de contaminantes prioritários', 'Compara contaminantes de maior gravidade e recomenda métodos de detecção por matriz ambiental.', 'Divisão de Segurança', ['contaminantes', 'riscos'], 33],
    ['Impactos de substâncias tóxicas em ecossistemas aquáticos', 'Sintetiza efeitos observados em peixes, plâncton e comunidades ribeirinhas.', 'Divisão Científica', ['impactos', 'ecossistemas'], 47],
  ].forEach(([titulo, resumo, autor, tags, d], i) => out.push({ id: `demo-rel-${i}`, tipo: 'relatorio', titulo, resumo, autor, tags, data: now - d * DAY, demo: true }));

  return out;
}

export const TEMPLATE_AMBIENTE = JSON.stringify({ ambiente: [
  { tipo: 'alerta', titulo: 'Título do alerta', severidade: 'alta', regiao: 'Região', descricao: 'Descrição curta', data: '2026-11-07' },
  { tipo: 'ocorrencia', categoria: 'queimada', lat: -12.5, lon: -55.7, regiao: 'Mato Grosso', data: '2026-11-07', intensidade: 3 },
  { tipo: 'agua', corpo: 'Rio exemplo', local: 'Cidade (UF)', classe: 'boa', ph: 7.1, oxigenio: 6.2, turbidez: 10, data: '2026-11-07' },
  { tipo: 'indicador', nome: 'Focos de queimadas', unidade: 'focos', historico: [{ periodo: 'set/26', valor: 900 }, { periodo: 'out/26', valor: 1200 }] },
  { tipo: 'contaminante', nome: 'Mercúrio', classe: 'Metal pesado', ocorreEm: ['água', 'peixes'], metodosDeteccao: ['espectrometria de absorção atômica'], impactos: 'Texto sobre os impactos', gravidade: 'alta' },
  { tipo: 'risco', cenario: 'Cenário de risco', local: 'Local', probabilidade: 3, severidade: 4, medidas: 'Medidas de controle' },
  { tipo: 'relatorio', titulo: 'Título do relatório', resumo: 'Resumo', autor: 'Autor', data: '2026-11-01', link: 'https://exemplo.com/relatorio.pdf', tags: ['tag1', 'tag2'] },
] }, null, 2);
