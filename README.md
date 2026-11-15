# Cofre Facial — front-end da APS de PIVC

Sistema de identificação e autenticação biométrica por reconhecimento facial para o cofre do Ministério do Meio Ambiente (tema da APS de Processamento de Imagem e Visão Computacional, 5º/6º CC, 2026/2).

Tecnologias (todas previstas no enunciado): **JavaScript** + **TensorFlow.js** (via `@vladmandic/face-api`). Interface em React + Vite. O reconhecimento roda 100% no navegador; os dados (pessoas, registros e ajustes) ficam no **Firebase Firestore** (projeto `trabalho-pivc`). Pode ser aberto com `npm run dev` ou publicado na pasta `htdocs` do **Apache/XAMPP**.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
```

Para publicar no XAMPP: `npm run build` e copie o conteúdo de `dist/` para `C:\xampp\htdocs\cofre\`. Abra `http://localhost/cofre/`.

A câmera só funciona em `localhost` ou `https`.

## Configurar o Firebase (uma vez)

1. No [console do Firebase](https://console.firebase.google.com/), projeto `trabalho-pivc`: **Build → Firestore Database → Criar banco de dados**.
2. Aba **Regras**: cole o conteúdo de `firestore.rules` e publique.
3. A configuração do app web já está em `src/services/firebase.js`.

Coleções usadas: `users`, `logs`, `noticias`, `toxinas`, `ambiente` e `config/settings`. A sessão, o bloqueio por tentativas e a câmera escolhida continuam locais em cada navegador.

## Logo

O logo é lido de `src/assets/logo.png`. Se esse arquivo não existir, o sistema usa o `src/assets/logo.svg` que acompanha o projeto (`src/lib/logo.js` faz essa escolha). O logo aparece no topo, na tela inicial e no centro do mostrador do acesso. A interface não usa mais ícones: só texto e o logo.

## Fluxo de telas

1. **Início (`/`):** logo e três botões: Acesso, Laboratório de imagem e Registros.
2. **Acesso (`/acesso`):** reconhecimento facial com prova de vida. Aprovado, abre o painel.
3. **Painel (`/painel`):** "Seja bem-vindo!" com os botões do nível da pessoa reconhecida:
   - Nível 1 (permissão geral): Notícia.
   - Nível 2 (diretor): Notícia e Indicador.
   - Nível 3 (ministro): Notícia, Indicador, Relatório Toxina, Cadastrar Pessoa e Pessoa Autorizada.
4. **Páginas exclusivas:** `/noticias`, `/indicadores`, `/toxinas`, `/cadastro` e `/usuarios`. Sem sessão ativa ou sem nível suficiente, a página redireciona ou avisa.
5. **Menu do avatar (canto superior direito):** painel, trancar e sair e, para o ministro, Registros, Gerenciar notícias, Importação em massa e Configurações.

## Primeiro uso

1. Abra **Cadastrar rosto**. Enquanto não houver ministro, a área está aberta e o primeiro cadastro precisa ser o **Nível 3**.
2. Capture 5 amostras do rosto (câmera ou fotos).
3. Em **Acesso**, escolha o compartimento e faça a verificação. Depois do cadastro do ministro, as telas Registros, Cadastro, Pessoas e Configurações só abrem para ele autenticado.

Se perder o acesso do ministro: apague a coleção `users` no console do Firebase (volta à configuração inicial).

## Requisitos da APS × onde estão

| Requisito | Onde |
|---|---|
| Reconhecimento facial em tempo real | `src/pages/Acesso.jsx` (laço de detecção sobre o vídeo) |
| Imagem de referência por câmera ou scanner/foto | `Cadastro.jsx` (câmera ou envio de fotos) |
| Níveis 1, 2 (diretor de divisão) e 3 (ministro exclusivo) | `src/lib/access.js` (regras) e `Cofre.jsx` |
| Cinco fases do processamento de imagens | `Pipeline.jsx` (Laboratório) e `src/lib/imageProc.js` |
| Tratamento de erros | câmera negada/ausente/ocupada, sem luz, rosto pequeno, mais de um rosto, foto desfocada, armazenamento cheio, backup inválido |
| Funções extras | prova de vida (virar o rosto), bloqueio após tentativas negadas, foto de quem foi negado, sessão de 5 minutos, validação de qualidade da amostra, bloqueio de rosto duplicado |
| Notícias no Nível 1 | `components/Noticias.jsx` (lê a coleção `noticias`); o ministro cadastra em `pages/GerenciarNoticias.jsx` (manual ou importando feeds RSS via `services/noticias.js`) |
| Importação em massa | `pages/ImportacaoMassa.jsx` e `lib/importer.js` (CSV/JSON de toxinas e notícias); o bloco “Catálogo completo” aceita o JSON `{ colecoes: { toxinas, alertas, divisoes } }`; as toxinas aparecem em `components/Toxinas.jsx` conforme `nivelMinimoAcesso` e `divisoesPermitidas` (Nível 1: nível 1 sem divisão; Nível 2: até nível 2 e da divisão; Nível 3: todas) |
| Nível 2 e Nível 3 | `components/Monitoramento.jsx` (alertas, mapa, água, tendências e qualidade do ar em tempo real) e `components/Inteligencia.jsx` (contaminantes, matriz de risco, impactos e relatórios), com dados da coleção `ambiente` (`lib/ambiente.js`, importação em `ImportacaoMassa.jsx`, demonstração em `lib/demoAmbiente.js`) |
| Relatórios | `Registros.jsx`: painel, filtros, exportação CSV e impressão |

As cinco fases (figura do enunciado): aquisição → pré-processamento (cinza, equalização, gaussiano) → segmentação (detector CNN, máscara de pele YCbCr, Sobel) → extração de características (68 pontos + vetor de 128) → classificação e interpretação (distância euclidiana 1:N + nível de acesso).

## Estrutura

```
src/services/   firebase (configuração) e cloud (Firestore)
src/lib/        faceEngine (modelos), imageProc (filtros à mão), liveness, access (regras), storage (sessão local)
src/pages/      Acesso, Cofre, Pipeline, Cadastro, Usuarios, Registros, Configuracoes
src/components/ Layout, Dial, Viewport, AdminGate, ...
public/models/  pesos dos modelos (carregados localmente, sem internet)
```

## Limites para citar na dissertação

- Os dados (descritores, registros) ficam no Firestore (`src/services/cloud.js`). O app não tem login do Firebase: as regras em `firestore.rules` liberam leitura e escrita nas três coleções para qualquer cliente. Serve para a APS, mas em produção os descritores faciais precisariam de autenticação e regras por usuário.
- A prova de vida é básica: barra foto parada, mas não um vídeo gravado.
- Os documentos do cofre são fictícios.
- O limite de distância (0,50) é ajustável em Configurações; documente os testes de FAR/FRR que você fizer.

