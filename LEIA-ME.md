# PesquisaFO — versão local refinada (v21)

## Abrir

http://127.0.0.1:8765/app.html

Se o servidor estiver fechado, executar Abrir-PesquisaFO.cmd e manter a janela aberta. Requer Node.js, já instalado neste PC. Para carregar uma nova versão no navegador, escolher Atualizar quando surgir o aviso.

Esta pasta é independente. A pasta original e o GitHub não foram modificados.
Cópia anterior: ../PesquisaFO-backup-v19.

## Alterações desta revisão

- Pesquisa com sugestões ordenadas, navegação pelas setas, Enter e Escape.
- Limpeza dos resultados ao substituir ou esquecer o CSV e indicação explícita do ficheiro mantido se uma importação falhar.
- Resumo dos dados importados, mensagens junto aos campos, temas com contraste e navegação SVG consistente.
- Comparação bloqueada durante carregamento, após erro ou perante portos duplicados/sem identificação; nenhum resultado antigo permanece associado ao novo ficheiro.
- Resumo numérico e listas expansíveis; troca de serviço, portos novos/removidos e estados operacionais alterados, incluindo portos sem serviço.
- Aviso quando o filtro não encontra portos sem serviço. Os botões indicam que partilham o resultado completo.
- Calculadora com validação inteira e mensagens acessíveis, sem manter um resultado antigo para uma entrada inválida.
- Bibliotecas do mapa e PDF incluídas em vendor, usando as versões anteriores. A instalação offline guarda-as juntamente com a aplicação. O fundo cartográfico continua dependente da rede.
- Metadados dos ícones corrigidos para as dimensões reais (1024 x 1024).

## Validação

Testes automáticos no Microsoft Edge: dois CSV fornecidos, 26 trocas de serviço, 73 portos adicionados e 58 removidos; importação inválida; pesquisa por teclado; temas; larguras 320–1366 px; recuperação offline do CSV; calculadora e descarga do PDF offline; sintaxe dos scripts, incluindo os scripts incorporados nas páginas.
Ainda falta experimentar em Android e iPhone reais. Não se considera a simples ausência de ID de serviço uma confirmação de disponibilidade para instalação.

## Dados e publicação futura

Os CSV não fazem parte desta pasta e não são enviados para um servidor pela pesquisa/comparação. O navegador guarda o CSV localmente para restauro.
Para publicar, incluir vendor e icons. server.cjs, verify.cjs, Abrir-PesquisaFO.cmd, preview-*.png e este documento são auxiliares locais; as imagens de teste podem conter dados do CSV e não devem ser publicadas. Alterar CACHE_NAME no service-worker.js em cada nova versão.
