
// Base de informações ambientais e científicas.
// Não contém medições, ocorrências ou alertas ambientais fictícios.
// Dados ambientais reais devem ser inseridos a partir de fontes oficiais.

export function demoAmbiente() {
  const out = [];

  // Informações científicas sobre contaminantes.
  // Os impactos e métodos são referências gerais.
  // A aplicação não deve interpretá-los como resultados de análises laboratoriais.

  [
    [
      'Mercúrio',
      'Metal pesado',
      ['água', 'sedimentos', 'peixes'],
      ['espectrometria de absorção atômica por vapor frio', 'ICP-MS'],
      'O mercúrio pode sofrer transformação em metilmercúrio, que se bioacumula na cadeia alimentar aquática. A exposição pode causar efeitos neurológicos.',
      'alta'
    ],
    [
      'Chumbo',
      'Metal pesado',
      ['solo', 'poeira', 'água de tubulações antigas'],
      ['espectrometria de massa com plasma indutivamente acoplado (ICP-MS)', 'espectrometria de absorção atômica'],
      'A exposição ao chumbo pode prejudicar o desenvolvimento neurológico, especialmente em crianças, e causar efeitos em outros sistemas do organismo.',
      'alta'
    ],
    [
      'Cádmio',
      'Metal pesado',
      ['solo', 'água', 'alimentos'],
      ['espectrometria de absorção atômica', 'ICP-MS'],
      'A exposição prolongada ao cádmio pode causar danos renais e efeitos adversos nos ossos.',
      'media'
    ],
    [
      'Organofosforados',
      'Agrotóxico',
      ['água', 'solo', 'alimentos'],
      ['cromatografia líquida ou gasosa acoplada à espectrometria de massas'],
      'Determinados organofosforados inibem a enzima acetilcolinesterase e podem provocar efeitos neurológicos em seres humanos e animais.',
      'alta'
    ],
    [
      'Microcistinas',
      'Cianotoxina',
      ['reservatórios', 'lagos', 'água'],
      ['imunoensaio (ELISA)', 'cromatografia líquida'],
      'São toxinas produzidas por determinadas cianobactérias. A exposição pode causar danos hepáticos e comprometer a segurança da água.',
      'alta'
    ],
    [
      'Aflatoxinas',
      'Micotoxina',
      ['grãos', 'amendoim', 'alimentos armazenados inadequadamente'],
      ['cromatografia líquida', 'imunoensaio'],
      'São micotoxinas produzidas por determinados fungos. Algumas, especialmente a aflatoxina B1, apresentam potencial carcinogênico e podem causar danos hepáticos.',
      'alta'
    ],
    [
      'Hidrocarbonetos policíclicos aromáticos',
      'Poluente orgânico',
      ['ar', 'solo', 'águas costeiras'],
      ['cromatografia gasosa com espectrometria de massas'],
      'Podem ser originados da combustão incompleta de matéria orgânica e de derivados de petróleo. Alguns compostos desse grupo são carcinogênicos.',
      'media'
    ]
  ].forEach(([nome, classe, ocorreEm, metodosDeteccao, impactos, gravidade], i) => {
    out.push({
      id: `cont-${i}`,
      tipo: 'contaminante',
      nome,
      classe,
      ocorreEm,
      metodosDeteccao,
      impactos,
      gravidade
    });
  });

  // Não são inseridos alertas, ocorrências, medições de água,
  // indicadores históricos, relatórios ou riscos sem fontes verificadas.

  return out;
}

// Modelo de estrutura para importação de dados ambientais.
// Os valores abaixo são exemplos de preenchimento, não dados reais.
// Substituir pelos registros obtidos de fontes oficiais.

export const TEMPLATE_AMBIENTE = JSON.stringify({
  ambiente: [
    {
      tipo: 'alerta',
      titulo: 'Título do alerta',
      severidade: 'alta',
      regiao: 'Região',
      descricao: 'Descrição baseada em fonte oficial',
      data: 'AAAA-MM-DD'
    },
    {
      tipo: 'ocorrencia',
      categoria: 'queimada',
      lat: 0,
      lon: 0,
      regiao: 'Região',
      data: 'AAAA-MM-DD',
      intensidade: 0
    },
    {
      tipo: 'agua',
      corpo: 'Nome do corpo hídrico',
      local: 'Cidade (UF)',
      classe: 'classe conforme classificação aplicável',
      ph: null,
      oxigenio: null,
      turbidez: null,
      data: 'AAAA-MM-DD'
    },
    {
      tipo: 'indicador',
      nome: 'Nome do indicador',
      unidade: 'unidade de medida',
      historico: [
        {
          periodo: 'mes/AA',
          valor: null
        }
      ]
    },
    {
      tipo: 'contaminante',
      nome: 'Nome do contaminante',
      classe: 'Classe',
      ocorreEm: [],
      metodosDeteccao: [],
      impactos: 'Descrição científica referenciada',
      gravidade: 'alta'
    },
    {
      tipo: 'risco',
      cenario: 'Cenário identificado',
      local: 'Local',
      probabilidade: null,
      severidade: null,
      medidas: 'Medidas baseadas em avaliação técnica'
    },
    {
      tipo: 'relatorio',
      titulo: 'Título do relatório',
      resumo: 'Resumo do documento oficial',
      autor: 'Instituição responsável',
      data: 'AAAA-MM-DD',
      link: '',
      tags: []
    }
  ]
}, null, 2);
