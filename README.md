# SIGSS+ — Extensão de Produtividade para o SIGSS Betim

O **SIGSS+** é uma extensão para Google Chrome (Manifest V3) desenvolvida para atuar como uma camada de produtividade inteligente sobre o sistema SIGSS (Sistema de Informação e Gestão de Serviços de Saúde) do município de Betim/MG. 

O foco da extensão **não é modificar** o funcionamento interno do SIGSS, mas adicionar automações locais, facilidades de uso e otimização de tempo de trabalho para os servidores públicos das Unidades Básicas de Saúde (UBS).

---

## 🎯 Objetivo e Diretrizes

* **Foco no Usuário:** Desenvolvido especificamente para servidores da Atenção Primária à Saúde (APS), que possuem níveis variados de intimidade com a informática. O sistema deve ser autônomo, silencioso e visualmente integrado.
* **Segurança e Privacidade:** A extensão **nunca** armazena dados médicos dos pacientes, não envia informações para servidores externos (sem telemetria) e funciona de maneira 100% local. O cache de fila serve estritamente para leitura em caso de falha de conexão.
* **Sobriedade Visual:** Interface limpa que simula o próprio SIGSS, sem cores vibrantes ou animações desnecessárias. A extensão deve parecer uma parte nativa do sistema.
* **Gratuidade Total:** Licenciado sob termos permissivos de uso, livre de qualquer custo ou cobrança de licenças.

---

## 🚀 Funcionalidades da Versão 1.0

1. **Relógio em Tempo Real:** Corrige a hora desatualizada exibida no cabeçalho do portal SIGSS, sincronizando-a dinamicamente com o relógio local da máquina do usuário.
2. **Atualização Automática (Fila):** Executa o clique automático no botão "Buscar" da fila em intervalos selecionáveis (5s a 60s). Possui travas inteligentes de segurança para não atualizar caso a aba esteja em segundo plano ou o usuário esteja preenchendo um campo de texto.
3. **Ordenação Persistente:** Mantém automaticamente a ordenação da fila por *Data Solicitação* (mais recente primeiro) mesmo após reloads ou buscas no grid.
4. **Cache Local da Fila:** Armazena o HTML da última tabela carregada com sucesso. Se o SIGSS cair ou ficar indisponível, um banner alertará o usuário, oferecendo visualização instantânea em tela cheia do último estado conhecido (modo offline somente-leitura).
5. **Automação de Lançamentos (Modo Aprendizado):** Módulo inteligente que localiza a equipe ESF do paciente na tela de lançamento. Ao clicar em **"Capturar Configuração"**, a extensão lê os IDs internos selecionados pelo usuário para *Profissional, Equipe e CBO*. Nos próximos lançamentos de pacientes da mesma ESF, esses dados são auto-selecionados com atrasos seguros de carregamento de Ajax.

---

## 🛠️ Tecnologias Utilizadas

* **Linguagem Principal:** TypeScript (compilação estrita e tipagem estática)
* **Estruturação & Estilização:** HTML5 e Vanilla CSS (estilo nativo leve e rápido)
* **Plataforma:** Manifest V3 das Extensões do Google Chrome
* **Empacotamento & Build:** [esbuild](https://esbuild.github.io/) (compilador ultra-rápido para JS/TS sem sobrecarga)
* **Sem Frameworks:** Sem React, Angular ou Vue. Desempenho e compatibilidade máxima sem peso extra.

---

## 📐 Arquitetura do Projeto

O projeto adota uma arquitetura desacoplada e modular de alta manutenibilidade. Nenhuma funcionalidade acessa o DOM diretamente fora do adaptador central:

```
SIGSS+
├── assets/                  # Ícones PNG de publicação do projeto
├── mock/                    # Mockups de teste local (Fila e Lançamentos)
├── scripts/                 # Scripts auxiliares de compilação automática
├── src/
│   ├── background.ts        # Service worker do Chrome (abertura do cache offline)
│   ├── manifest.json        # Arquivo de metadados da extensão do Chrome
│   ├── core/
│   │   ├── core.ts          # Script de conteúdo (Content script) - Ponto de Entrada
│   │   └── config.ts        # Gerenciador de leitura/escrita do chrome.storage.local
│   ├── modules/
│   │   ├── clock/           # Módulo do Relógio do Cabeçalho
│   │   ├── autoRefresh/     # Módulo de cliques e visibilidade da Fila
│   │   ├── queueCache/      # Módulo de salvamento de HTML da Fila
│   │   └── autoAssignment/  # Módulo de automação de formulários de Lançamento
│   └── ui/
│       ├── offline/         # Página de visualização de fila salva offline
│       ├── popup/           # Painel de controle suspenso da barra de ferramentas
│       └── options/         # Página de configurações ampliadas e backups
```

### O Padrão `SigssAdapter`
Para garantir a longevidade do projeto, criamos a classe de abstração [SigssAdapter](file:///c:/Users/guilh/Documents/Programação/SIGSS%20extension/src/utils/sigssAdapter.ts). Toda a identificação de botões, leitura de textos e seleção de campos do SIGSS ocorre exclusivamente nessa classe.
Se a TI do município atualizar a estrutura HTML ou alterar IDs do SIGSS, a extensão não quebrará por completo; basta atualizar os seletores CSS centralizados nesta classe adaptadora.

---

## 💻 Como Desenvolver e Executar

### Pré-requisitos
* Ter o [Node.js](https://nodejs.org/) instalado na máquina (versão 18 ou superior recomendada).

### Instalação de Dependências
Abra o terminal no diretório da extensão e instale as dependências de desenvolvimento:
```bash
npm install
```

### Compilar a Extensão
Rode o script de compilação principal para gerar a pasta `dist/`:
```bash
npm run build
```

Para desenvolvimento interativo, você pode rodar o compilador em modo observador (watch mode). Ele detectará qualquer alteração no código TS/HTML/CSS e recompilará o projeto em tempo real:
```bash
npm run watch
```

---

## 🛠️ Como Instalar no Google Chrome

1. Abra o Google Chrome.
2. Acesse a página de extensões através do link: `chrome://extensions/`.
3. No canto superior direito, ative a chave **"Modo do desenvolvedor"**.
4. No canto superior esquerdo, clique no botão **"Carregar sem compactação"**.
5. Selecione a pasta **`dist`** que foi criada na raiz do projeto SIGSS+ após rodar a compilação.
6. A extensão estará instalada e pronta para uso!

*Dica para Testes Locais:* Para testar nos arquivos de simulação da pasta `/mock`, acesse as opções da extensão no painel de extensões do Chrome e ative a opção **"Permitir acesso a URLs de arquivo"**.

---

## 🔮 Roadmap Futuro (O que pode ser integrado)

Embora a arquitetura facilite expansões, os recursos abaixo não devem ser adicionados na versão atual:
* Sincronização em nuvem entre computadores da mesma UBS.
* Painel de estatísticas e painéis de desempenho das filas locais.
* Geração de relatórios de produtividade dos profissionais.
* Sistema interno de avisos e recados curtos para comunicação entre funcionários na UBS.

---

## 📝 Licença e Créditos

Este software é de código aberto sob licença MIT. 

* **Idealização e Desenvolvimento:** Guilherme Paicheco Ferreira (Servidor Público Municipal da Prefeitura de Betim/MG).
* Desenvolvido de forma voluntária, visando simplificar as rotinas de trabalho das equipes de Atenção Primária.
