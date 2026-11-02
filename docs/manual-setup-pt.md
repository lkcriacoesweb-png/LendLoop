# O que Lucas precisa fazer

## Já disponível localmente

O código fica nesta pasta. Execute `npm ci` e `npm run dev`, depois abra `http://127.0.0.1:3000/preview`. A prévia usa dados fictícios e perde alterações ao recarregar. O README em inglês contém os passos completos.

## 1. Clerk

1. Abra https://dashboard.clerk.com/ e crie uma aplicação de **desenvolvimento** `LendLoop`.
2. Habilite login por e-mail.
3. Ative a integração Convex no painel Clerk.
4. Copie `.env.example` para `.env.local` se o arquivo ainda não existir. Preencha somente as duas chaves do Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY`.
5. Guarde a URL Frontend API/issuer (`https://...clerk.accounts.dev`) para o Convex. Não mande segredos no chat.

## 2. Convex

1. Crie sua conta em https://dashboard.convex.dev/.
2. No terminal desta pasta, execute `npx convex dev` e conclua o login no navegador.
3. Crie/selecione o projeto novo `LendLoop`. A CLI registra a URL e o deployment em `.env.local`.
4. No ambiente **development** do painel Convex, configure `CLERK_JWT_ISSUER_DOMAIN` com o domínio Clerk acima.
5. Reinicie `npx convex dev` e confira se as funções foram sincronizadas.
6. Reinicie `npm run dev`. Faça login em `/workspace` e crie um nome fictício. Repita em outra sessão para termos dois usuários de teste.

## 3. n8n

Escolha uma instância **nova e isolada de teste**, sem workflows e credenciais dos seus clientes. O PC ainda precisa de Docker Desktop se você optar pelo Compose local. Uma instância de desenvolvimento no dedicado é uma alternativa, mas a configuração de exposição/TLS deve ser revisada antes de abrir o serviço.

O Convex na nuvem não consegue chamar `localhost` do PC. Por isso precisamos de uma URL HTTPS alcançável do n8n de teste, ou de um túnel de desenvolvimento aprovado. Não publique o editor inteiro só para receber o webhook.

1. Copie `n8n/.env.example` para `n8n/.env` e preencha os segredos aleatórios, todos diferentes.
2. Coloque `AUTOMATION_OUTBOUND_SECRET` e `AUTOMATION_INBOUND_SECRET` também no painel Convex.
3. Inicie o Compose e importe primeiro `error-handler.json`, depois os outros dois JSONs.
4. Nas configurações dos workflows A e B, selecione o workflow C como tratamento de erro.
5. Ative A e B e configure `N8N_WEBHOOK_URL` no Convex com a URL permanente `/webhook/lendloop-events`.
6. Execute o roteiro de verificação real em `docs/verification.md`. Registre só IDs não sensíveis.

## 4. GitHub e candidatura

Repositório informado: https://github.com/lkcriacoesweb-png/LendLoop. Deve continuar privado durante a preparação. A pasta `application/fluence` é local, ignorada pelo Git, e contém rascunhos pessoais.

O remote `origin` já aponta para esse repositório. Neste PC, a CLI do GitHub ainda precisa de autenticação. Execute `gh auth login --hostname github.com --git-protocol https --web` e depois `gh auth setup-git`, usando a conta `lkcriacoesweb-png`. Não envie tokens pelo chat. O push só pode ser concluído depois desse login; o repositório não deve ser tornado público automaticamente.

Antes de enviar, faltam: validar integrações, definir link real de demonstração, tornar o código acessível ao avaliador, revisar o currículo e o texto final. O e-mail da vaga é `techjobs@fluencetraining.com`. O rascunho inclui Remotive, a palavra `pineapple` e divulgação contextualizada da assistência de IA. Nada foi enviado.
