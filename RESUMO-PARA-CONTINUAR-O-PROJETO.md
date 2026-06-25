# Projeto Sabor de Mae / Comanda Facil

Este arquivo resume o projeto para continuar em outro chat sem precisar explicar tudo de novo.

## Objetivo

Criar um sistema para o restaurante **Sabor de Mae**, localizado na **Rua Rio Negro, 1890**, com:

- site publico para clientes fazerem pedidos;
- painel administrador para o restaurante receber pedidos;
- cardapio editavel com fotos;
- pedidos salvos no Supabase;
- preparacao para imprimir pedidos na impressora termica de rede.

WhatsApp do restaurante: `5569992824311`.

## Links

- Site publico: https://imperdor444.github.io/comanda-facil/
- Painel administrador: https://imperdor444.github.io/comanda-facil/painel.html
- Comandas locais antigas: https://imperdor444.github.io/comanda-facil/admin.html
- Repositorio GitHub: https://github.com/Imperdor444/comanda-facil

## Supabase

Projeto Supabase:

- URL: `https://eskoaldublplqjkxghtj.supabase.co`
- Project ref: `eskoaldublplqjkxghtj`
- Usuario admin criado: `lulureis@gmail.com`
- A senha foi informada no chat anterior, mas deve ser trocada depois.

Importante:

- Nao usar `service_role` no frontend.
- O site usa chave publica anon com RLS.
- Storage publico `produtos` foi criado para fotos dos produtos.

Arquivos SQL importantes:

- `supabase/schema.sql`: estrutura principal.
- `supabase/storage.sql`: bucket/policies de imagens.
- `supabase/grants.sql`: permissoes publicas da API.
- `supabase/order-policies.sql`: policies para pedido do site.

## Funcionalidades ja feitas

Site publico:

- Cardapio separado por categorias: Marmitex, Consumo local, Bebidas.
- Cliente adiciona itens ao carrinho.
- Cliente preenche nome, entrega/retirada, endereco, pagamento e observacao.
- Campo de troco so aparece quando pagamento for dinheiro.
- Pedido finaliza direto pelo site, sem abrir WhatsApp automaticamente.
- Depois de confirmar, aparece mensagem `Pedido confirmado` com simbolo de concluido.
- WhatsApp fica como opcao secundaria.

Painel:

- Login via Supabase.
- Lista pedidos do site.
- Mostra status: novo, aceito, preparando, finalizado, cancelado.
- Permite mudar status.
- Mostra produtos separados por categoria.
- Cadastro/edicao de produtos.
- Upload de foto do produto para Storage do Supabase.
- Botao para ativar som.
- Atualizacao automatica e monitoramento de pedidos.
- Destaque visual para pedido novo.
- Area de impressora termica com:
  - imprimir automaticamente;
  - servidor local;
  - IP da impressora;
  - porta;
  - teste de impressao.

## Impressora termica

Impressora identificada antes:

- IP: `192.168.1.223`
- Porta: `9100`
- Tipo: ESC/POS de rede

Servidor local:

- Arquivo: `print-server.js`
- Porta local: `8787`
- URL local: `http://127.0.0.1:8787`

Comando para ligar o servidor de impressao:

```powershell
node print-server.js
```

Tambem foi criado:

- `print-monitor.js`

Ele monitora pedidos novos do Supabase e envia para a impressora. Usa variaveis de ambiente para login, para nao salvar senha no codigo:

```powershell
$env:SABOR_DE_MAE_EMAIL="lulureis@gmail.com"
$env:SABOR_DE_MAE_PASSWORD="SENHA_AQUI"
node print-monitor.js
```

Observacao importante:

- O painel publicado em `https://imperdor444.github.io` pode ser bloqueado pelo navegador ao tentar chamar `http://127.0.0.1:8787`.
- Para imprimir pelo PC local, pode ser melhor usar o painel local ou o `print-monitor.js`.

## Estado atual da impressora

O servidor local respondeu, mas a impressora ficou inacessivel no ultimo teste:

- `192.168.1.223:9100` nao respondeu.
- A rede mostrou `192.168.1.223` como `Unreachable`.

Provavel motivo:

- impressora desligada;
- impressora fora da rede;
- IP mudou;
- cabo/rede desconectado.

Proximo teste quando a impressora ligar:

1. Testar conexao:

```powershell
Test-NetConnection -ComputerName 192.168.1.223 -Port 9100
```

2. Ligar servidor:

```powershell
node print-server.js
```

3. Testar:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8787/health
```

4. Enviar comprovante teste para a impressora.

## Arquivos principais

- `index.html`: site publico.
- `site.css`: estilo do site.
- `site.js`: carrinho/pedido do site.
- `painel.html`: painel administrador.
- `painel.css`: estilo do painel.
- `painel.js`: login, pedidos, produtos, upload, alertas e impressao.
- `supabase-config.js`: configuracao publica do Supabase.
- `supabase-client.js`: helper do Supabase.
- `print-server.js`: servidor local que envia texto para a impressora.
- `print-monitor.js`: monitor local de pedidos novos.

## Proximos passos sugeridos

1. Confirmar que a impressora esta ligada e respondendo.
2. Testar impressao de um pedido formal.
3. Ajustar layout do comprovante se precisar.
4. Decidir se a parte antiga de `Comandas` fica escondida como backup/modo local.
5. Testar com a dona do restaurante no celular:
   - cadastrar produto;
   - subir foto;
   - receber pedido;
   - mudar status;
   - imprimir.

## Observacoes de seguranca

- Nao salvar senha no GitHub.
- Trocar a senha do usuario admin depois dos testes.
- Nao usar `service_role` no frontend.
- Para producao, o ideal e deixar a impressora ligada a um computador/mini PC limpo no restaurante.
