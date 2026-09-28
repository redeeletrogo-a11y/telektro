# Design System Telektro

O dashboard usa um tema claro operacional com navegação em azul-petróleo escuro. Verde-água identifica energia e estados positivos; âmbar sinaliza atenção; vermelho é reservado para falhas. O verde não domina a identidade.

## Tokens iniciais

Os tokens ficam em `apps/web/src/app/globals.css`:

- cores de superfície, texto, marca, energia e estados;
- tipografia de interface e fonte técnica;
- espaçamento de 4, 8, 12, 16, 24, 32 e 48 px;
- radius para controles, painéis e overlays;
- sombra leve de painel e duração curta de microinterações.

## Regras de interface

- O estado e as unidades são escritos junto dos números; cor não é o único sinal.
- Gráficos são SVG no frontend e incluem unidade, limite de capacidade, eixo de tempo e descrição acessível.
- Dados demonstrativos exibem faixa e rótulos persistentes.
- A navegação principal se torna uma barra inferior em telas estreitas.
- Componentes reutilizáveis devem consumir os mesmos tokens, evitando sombras e gradientes pesados.
