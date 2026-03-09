# PromptsParaHistorias

Ferramenta que recebe narrações em .srt e gera prompts de imagens em movimento para acompanhar a história com consistência visual.

## Como Usar

1. Clone o repositório
1. Copie `.env.example` para `.env` e adicione sua chave da OpenAI
2. Basta clicar duas vezes em `INICIAR_APP.bat` para abrir tudo automaticamente.
3. Ou use: `npm install` e `npm start`
4. Acesse `http://localhost:3500`

## Funcionalidades

- Upload de arquivos .srt
- Análise automática da história (personagens, locais, objetos, ambientação)
- Seleção de estilo visual com menu de opções + personalizado
- Cards editáveis para cada elemento identificado
- Geração de prompts de cenas em movimento (máx. 6s cada)
- Consistência visual mantida por referência cruzada de elementos
- Exportação de prompts em arquivos de texto

## Requisitos

- Node.js 18+
- Chave de API da OpenAI

## Configuração

```bash
cp .env.example .env
# Edite .env com sua chave da OpenAI
npm install
npm start
```
