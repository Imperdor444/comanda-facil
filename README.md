# Comanda Facil

Sistema simples para restaurante usar pelo celular.

## Links

- Site publico do restaurante: `index.html`
- Sistema interno de comandas: `admin.html`

## Como publicar no GitHub Pages

1. Crie um repositorio novo no GitHub.
2. Envie todos os arquivos desta pasta para o repositorio.
3. No GitHub, abra `Settings`.
4. Entre em `Pages`.
5. Em `Build and deployment`, escolha `Deploy from a branch`.
6. Selecione a branch `main` e a pasta `/root`.
7. Salve e aguarde o GitHub gerar o link.

Depois de publicado, abra o link no Chrome do celular e use `Adicionar a tela inicial` para instalar o app.

## O que ja funciona

- Cadastro de produtos com preco e categoria.
- Abertura de comandas por mesa, balcao ou nome do cliente.
- Adicao e remocao de itens na comanda.
- Fechamento da conta.
- Relatorio simples das vendas do dia.
- Impressao de comprovante pelo menu de impressao do celular.
- Funcionamento offline depois de instalado como app/PWA.

## Como testar no celular

1. Publique esta pasta em um servidor HTTPS ou rode em um servidor local na mesma rede.
2. Abra o endereco pelo Chrome do celular.
3. Use a opcao "Adicionar a tela inicial" ou "Instalar app".
4. Abra o app instalado uma vez com internet.
5. Depois disso, ele continua abrindo offline no celular.

## Impressora termica

Ao fechar uma comanda, o sistema abre a impressao do celular. Se a impressora aparecer como destino de impressao no Android, basta selecionar e imprimir.

Esta impressora foi identificada como ESC/POS de rede em `192.168.1.223:9100`. Para imprimir direto nela, rode o servidor de impressao em um computador ligado na mesma rede:

```bash
node print-server.js
```

Depois abra o sistema no mesmo computador ou configure o celular para acessar o servidor do computador. O terminal mostra o endereco para usar no celular, por exemplo:

```text
Celular na mesma rede: http://192.168.1.106:8787
```

No app, entre em `Ajustes`, coloque esse endereco no campo `Servidor de impressão` e toque em `Testar impressão`.

## Proximas etapas boas

- Forma de pagamento no fechamento.
- Cancelamento e desconto.
- Backup/exportacao das vendas.
- Controle de estoque.
- Tela separada para cozinha.
- Cadastro de usuarios com senha.
