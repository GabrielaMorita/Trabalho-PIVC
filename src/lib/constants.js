export const LEVELS = {
  1: { id: 1, short: 'Nível 1', title: 'Permissão geral', who: 'Servidores com permissão geral' },
  2: { id: 2, short: 'Nível 2', title: 'Diretor de divisão', who: 'Diretores de divisões específicas' },
  3: { id: 3, short: 'Nível 3', title: 'Ministro', who: 'Ministro do Meio Ambiente (exclusivo)' },
};

export const DIVISIONS = [
  'Controle de Substâncias Tóxicas',
  'Biossegurança e Resíduos',
  'Fiscalização Ambiental',
  'Pesquisa e Monitoramento',
  'Divisão Científica',
  'Divisão de Segurança',
];

export const DEFAULT_SETTINGS = {
  threshold: 0.5, // distância euclidiana máxima entre descritores (menor = mais rígido)
  consecutive: 3, // quadros consecutivos que precisam concordar para autorizar
  requireLiveness: true, // prova de vida (virar o rosto para o lado sorteado)
  inputSize: 320, // resolução de entrada do detector (múltiplo de 32)
  minFaceRatio: 0.2, // largura mínima do rosto em relação ao quadro
  sessionSeconds: 300, // duração da sessão após autenticação
  maxAttempts: 3, // tentativas negadas antes do bloqueio
  lockSeconds: 30, // tempo de bloqueio
  cameraId: '',
};

export const SAMPLES_REQUIRED = 5;
export const SAMPLE_PROMPTS = [
  'Olhe de frente, expressão neutra',
  'Gire levemente o rosto para a esquerda',
  'Gire levemente o rosto para a direita',
  'Incline o queixo um pouco para cima',
  'Sorria de leve',
];
