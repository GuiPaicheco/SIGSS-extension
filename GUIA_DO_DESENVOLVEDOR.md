# Guia do Desenvolvedor — SIGSS+

Olá, Guilherme! Este guia foi feito especialmente para você. Ele explica, de forma simples e detalhada, tudo o que você precisa saber para gerenciar, testar, compilar, distribuir e expandir a extensão **SIGSS+** após a entrega do projeto.

---

## 📂 Índice
1. [Preparação do Ambiente (Instalar Node.js)](#1-preparação-do-ambiente)
2. [Instalação de Dependências](#2-instalação-de-dependências)
3. [Compilação e Geração da Pasta Final](#3-compilação-da-extensão)
4. [Como Carregar a Extensão no Google Chrome](#4-como-carregar-no-chrome)
5. [Como Testar Cada Módulo Usando os Mockups](#5-como-testar-os-módulos)
6. [Depuração de Erros com o Console do Chrome](#6-como-localizar-erros)
7. [Atualização da Extensão Após Alterar Código](#7-como-atualizar-a-extensão)
8. [Como Criar Backup das Configurações](#8-como-criar-backups)
9. [Como Gerar uma Nova Versão e Arquivo .ZIP](#9-gerando-nova-versão)
10. [Instalação em Outros Computadores da Prefeitura](#10-instalação-em-outras-máquinas)
11. [Como Adicionar um Novo Módulo no Futuro](#11-adicionando-novos-módulos)

---

## 1. Preparação do Ambiente

Para compilar o código TypeScript da extensão em arquivos JavaScript limpos que o navegador Chrome entende, você precisará do **Node.js** (que vem acompanhado do gerenciador de pacotes **npm**).

### Passo a Passo para Instalar o Node.js:
1. Acesse o site oficial: [https://nodejs.org/](https://nodejs.org/).
2. Baixe a versão **LTS** (Long Term Support - Recomendada para a maioria dos usuários).
3. Execute o instalador baixado no seu computador.
4. Avance por todas as telas do instalador ("Next", aceitar termos, "Next") mantendo as opções padrão marcadas.
5. Ao concluir, reinicie seu computador para garantir que os caminhos sejam reconhecidos pelo Windows.
6. **Para testar se funcionou:** Abra o Terminal do Windows (PowerShell ou Prompt de Comando) e digite:
   ```bash
   node -v
   npm -v
   ```
   Ambos devem retornar os números das versões instaladas (ex: `v20.12.2` e `10.5.0`).

---

## 2. Instalação de Dependências

O projeto utiliza o TypeScript para tipagem segura e o **esbuild** para fazer o empacotamento super-rápido dos arquivos da extensão.

### Como Instalar:
1. Abra o Terminal do Windows.
2. Navegue até a pasta do projeto `SIGSS extension` (ou use a opção "Abrir no Terminal" clicando com o botão direito na pasta do projeto).
3. Execute o comando:
   ```bash
   npm install
   ```
   Este comando lê o arquivo `package.json` e cria uma pasta chamada `node_modules` contendo as ferramentas TypeScript e esbuild de desenvolvimento. Isso é feito apenas uma única vez na máquina.

---

## 3. Compilação da Extensão

Você não deve carregar a pasta raiz do projeto diretamente no Chrome, mas sim a pasta **`dist`** que contém os arquivos finais empacotados.

### Como Compilar:
No terminal da pasta do projeto, execute o comando correspondente:
* **Compilação Única (Produção):**
  ```bash
  npm run build
  ```
  Este comando lerá a pasta `src/`, processará os arquivos TypeScript (`.ts`), copiará os arquivos HTML, CSS e ícones e criará tudo compactado dentro de uma nova pasta chamada **`dist`**.
* **Compilação Interativa (Desenvolvimento):**
  ```bash
  npm run watch
  ```
  Este modo é excelente enquanto você estiver programando. Ele bloqueia o terminal e fica "observando" a pasta `src/`. Qualquer alteração que você salvar em qualquer arquivo de código TypeScript, HTML ou CSS será recompilada na pasta `dist` em milissegundos de forma automática.

---

## 4. Como Carregar no Chrome

Uma vez criada a pasta **`dist`**, você já pode instalá-la no navegador em modo desenvolvedor.

1. Abra o Google Chrome.
2. Na barra de endereços, acerte a URL das extensões: `chrome://extensions/`.
3. No canto superior direito, ative a opção **"Modo do desenvolvedor"**.
4. No canto superior esquerdo, clique no botão **"Carregar sem compactação"**.
5. Navegue pelo gerenciador de arquivos do Windows, selecione a pasta **`dist`** (que está dentro do seu projeto `SIGSS extension`) e clique em **Selecionar pasta**.
6. O cartão da extensão **SIGSS+** deverá aparecer na sua tela!

### ⚠️ ETAPA OBRIGATÓRIA PARA TESTES LOCAIS:
Como vamos testar a extensão utilizando arquivos locais (mockups) que começam com `file:///`, o Google Chrome bloqueia as extensões por segurança de ler esses arquivos por padrão.
Para liberar:
1. Na mesma página `chrome://extensions/`, localize o cartão da extensão **SIGSS+** e clique no botão **Detalhes**.
2. Role a página até encontrar a chave **"Permitir acesso a URLs de arquivo"** e ative-a.
*Nota: Em produção, nos computadores da prefeitura, essa opção não será necessária porque a extensão rodará direto na URL HTTP do SIGSS.*

---

## 5. Como Testar os Módulos

Para facilitar seus testes sem precisar mexer no sistema SIGSS em produção (e correr o risco de gravar dados incorretos), nós criamos uma pasta contendo páginas de simulação em `mock/`.

### Como Testar o Módulo 1 (Relógio) e o Módulo 2 (Atualização Automática)
1. Localize o arquivo `mock/mock_sigss.html` na pasta do seu projeto.
2. Clique com o botão direito sobre ele e selecione **Abrir com** -> **Google Chrome**.
3. O cabeçalho exibirá o relógio central do computador (sinal de que a extensão corrigiu a hora fictícia inicial "12:34:56").
4. Clique no ícone de quebra-cabeça do Chrome (Extensões) e clique em **SIGSS+** para abrir o popup.
5. Altere a opção **Intervalo de Atualização** para **5 segundos**.
6. Observe a página: a cada 5 segundos, a extensão deve clicar sozinha no botão **Buscar** e atualizar o contador de cliques na tela de simulação.
7. **Teste de Segurança:** Foque o cursor dentro do campo de texto "Filtro Paciente" e comece a digitar. A contagem de atualização automática deve congelar, pois a extensão identificou que você está editando um formulário e evitou a perda de dados. Remova o foco ou apague o texto para que ela volte a atualizar.

### Como Testar o Módulo 3 (Cache Local)
1. Com a página do mockup da fila `mock_sigss.html` aberta, abra o popup da extensão e altere qualquer opção (para garantir que salvou uma versão limpa da tabela).
2. No popup, clique no botão **"Visualizar Última Fila Salva (Offline)"**.
3. Uma aba em tela cheia com a URL interna da extensão `offline_viewer.html` deve se abrir, exibindo os mesmos pacientes que estavam na tabela do mockup, com o carimbo de data e hora corretos de quando foi salva.
4. Tente clicar nas linhas ou cabeçalhos: você verá que a tabela está em modo somente consulta (cliques bloqueados).

### Como Testar o Módulo 4 (Automação de Lançamentos)
1. Localize o arquivo `mock/mock_sigss_launch.html` na pasta do projeto e abra no Chrome.
2. Note que a página exibe no topo `Equipe ESF: 086`. No formulário, os selects de Profissional, Equipe e CBO estarão desmarcados.
3. No final da página, ao lado do botão "Gravar Lançamento", você verá o botão cinza **"Capturar Configuração"** injetado pela extensão.
4. Selecione no formulário:
   * **Profissional:** Dr. João Silva
   * **Equipe:** Equipe Saúde da Família 130
   * **CBO:** 225142 - Medico da Estrategia de Saude da Familia
5. Clique no botão **"Capturar Configuração"**. O botão deve mudar de cor para verde e mostrar "✓ Configuração Capturada!".
6. Atualize a página do navegador (F5).
7. Assim que a página carregar novamente, a extensão lerá a ESF `086` e preencherá automaticamente os campos com o Dr. João Silva, a Equipe 130 e o CBO 225142 de forma sequencial com microatrasos (mostrados no console de eventos verde na tela).

---

## 6. Como Localizar Erros

Se algo não estiver funcionando ou se o SIGSS mudar o HTML no futuro, você poderá inspecionar onde o erro está ocorrendo.

### Depurando a Página (Content Script):
1. Na página do SIGSS onde o erro ocorre, clique com o botão direito em qualquer área vazia e escolha **Inspecionar** (ou aperte `F12`).
2. Clique na aba **Console**.
3. Erros da extensão aparecerão em vermelho acompanhados pelo prefixo `SIGSS+`. Se o problema for de elemento não encontrado, a mensagem do JavaScript indicando `null` apontará que a classe `SigssAdapter` não localizou o seletor.

### Depurando o Popup ou Opções:
1. Clique com o botão direito no ícone da extensão SIGSS+ na barra do Chrome e clique em **Opções** (ou clique com o botão direito dentro do popup aberto).
2. Escolha **Inspecionar**.
3. A janela de inspeção específica do popup abrirá. Verifique a aba **Console** para ver se há erros de gravação de arquivos ou falhas na leitura do storage.

---

## 7. Como Atualizar a Extensão

Sempre que você alterar o código-fonte TypeScript ou as interfaces HTML/CSS, siga os passos abaixo para que as modificações entrem em vigor no Chrome:

1. No terminal do projeto, execute:
   ```bash
   npm run build
   ```
2. Acesse a aba `chrome://extensions/` no seu navegador.
3. Localize o painel do **SIGSS+** e clique no pequeno ícone de círculo com seta (ou botão **Recarregar**) no canto inferior direito do painel da extensão.
4. Atualize as abas abertas do SIGSS no navegador (F5) para que o novo script compilado seja reinjetado.

---

## 8. Como Criar Backups

A extensão salva tudo no computador local usando a API `chrome.storage.local`. Se você for desinstalar a extensão ou formatar o computador, pode exportar as configurações e os mapeamentos das equipes ESF salvos para não perdê-los.

1. Clique com o botão direito no ícone da extensão SIGSS+ e selecione **Opções**.
2. No menu lateral esquerdo, clique em **Backup e Restauração**.
3. Para salvar: Clique em **Exportar Arquivo de Configuração**. Um arquivo JSON (ex: `sigss-plus-backup-2026-07-10.json`) será baixado no computador. Salve-o em um pen drive ou envie por e-mail.
4. Para restaurar em outro computador: Na mesma tela, clique em **Selecionar Arquivo e Importar**, escolha o arquivo JSON gerado e confirme. A tela de mapeamentos atualizará na hora com os novos dados.

---

## 9. Gerando Nova Versão

Sempre que você fizer alterações e desejar liberar uma atualização estável:
1. Abra o arquivo `src/manifest.json`.
2. Altere o número do campo `"version"` (ex: de `"1.0.0"` para `"1.0.1"` ou `"1.1.0"`).
3. Faça o mesmo no campo `"version"` do arquivo `package.json` para manter sincronia.
4. Execute no terminal o comando de compilação de produção:
   ```bash
   npm run build
   ```
5. Para gerar o pacote final compactado de distribuição, execute:
   ```bash
   npm run zip
   ```
   Isso executará um comando PowerShell integrado que compacta o conteúdo da pasta `dist/` gerando o arquivo **`sigss-plus.zip`** diretamente na raiz do projeto. Este é o arquivo que você usará para publicar ou distribuir!

---

## 10. Instalação em Outras Máquinas

Você tem duas opções para instalar a extensão nos computadores das UBSs da prefeitura:

### Opção A: Chrome Web Store (Recomendada no Futuro)
Se você optar por publicar oficialmente (a taxa única para criar conta de desenvolvedor na Google é de $5 dólares):
1. Acesse o painel de desenvolvedores do Chrome: [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Crie sua conta.
3. Clique em **Novo Item** e suba o arquivo `sigss-plus.zip` gerado.
4. Preencha a descrição, envie prints das telas e envie para revisão.
5. Após aprovada pelo Google (geralmente leva de 1 a 3 dias), os servidores da prefeitura poderão baixá-la diretamente na loja de extensões oficial de forma segura e com atualizações automáticas silenciosas sempre que você subir um ZIP novo.

### Opção B: Instalação Manual (Para rodar localmente sem a loja oficial)
Se você quiser instalar de graça em computadores pontuais sem passar pela loja oficial do Chrome:
1. Envie a pasta compilada `dist` (ou envie o arquivo `sigss-plus.zip` descompactado) para a máquina do servidor de destino.
2. Na máquina de destino, abra o Chrome em `chrome://extensions/`.
3. Ative o **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação** e selecione a pasta `dist` que você copiou na máquina dele.
*Nota: Ao instalar de forma manual em computadores de terceiros, o Chrome pode exibir um aviso ocasional lembrando que há uma extensão em modo desenvolvedor rodando. O servidor pode simplesmente fechar o aviso e continuar utilizando normalmente.*

---

## 11. Adicionando Novos Módulos

A extensão foi projetada de forma modular. Caso você queira criar um módulo novo no futuro (por exemplo, um painel de estatísticas chamado `dashboard`), siga este roteiro de desenvolvimento:

1. **Defina a interface no Adaptador:** Adicione na classe `SigssAdapter` (`src/utils/sigssAdapter.ts`) quaisquer seletores ou interações com elementos HTML específicos que seu novo módulo precisará interagir.
2. **Crie a pasta do módulo:** Crie uma pasta sob `src/modules/` (ex: `src/modules/dashboard/`).
3. **Crie a lógica do módulo:** Crie o arquivo TypeScript principal (ex: `dashboard.ts`). Desenvolva a classe exportando um método `start()` e `stop()`.
4. **Instancie no Core:** Abra o arquivo [core.ts](file:///c:/Users/guilh/Documents/Programação/SIGSS%20extension/src/core/core.ts):
   * Importe sua nova classe no topo.
   * Adicione como propriedade da classe `SIGSSPlusCore`.
   * Chame o método `.start()` dentro do bloco do roteador `switch (this.currentPage)` ou na inicialização geral dependendo da página em que ele deve rodar.
5. **Adicione os arquivos de build:** O `build.js` com o esbuild já está configurado para empacotar toda a árvore de dependências importada a partir do `core.ts` dentro do único arquivo final `dist/content.js`. Ou seja, se o módulo novo for importado e inicializado dentro do `core.ts`, o build o incluirá automaticamente na compilação sem precisar alterar o `build.js`!
