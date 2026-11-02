# Preparação para a entrevista

## Como explicar o projeto

Clerk é a portaria: autentica a pessoa e emite um token. Convex valida esse token, armazena os dados e aplica as regras. n8n recebe eventos assinados e executa as notificações. Next.js apresenta as telas. O navegador não é uma fonte confiável de permissões.

Por exemplo: um usuário pode esconder ou reexibir um botão com as ferramentas do navegador. Isso não o transforma em dono de uma ferramenta. `tools.edit` consulta a identidade validada e compara o proprietário no banco.

HMAC funciona como um selo calculado com um segredo compartilhado: alterar o conteúdo, o caminho ou o horário invalida o selo. Não cifra os dados; HTTPS continua necessário. A janela de tempo e os recibos de nonce impedem repetir efeitos indefinidamente.

Idempotência significa que repetir a mesma operação lógica não cria outro resultado. Se a resposta de “pedido recebido” se perder, a mesma chave devolve o pedido já criado. Se o n8n repetir o retorno de uma notificação, o resultado existente continua único.

Reservas concorrentes são resolvidas no backend: duas aprovações leem os empréstimos e escrevem a revisão da mesma ferramenta dentro de transações. Convex detecta o conflito e reexecuta uma delas; a segunda então encontra a reserva e rejeita a sobreposição. Os testes locais verificam a regra; o teste no serviço real ainda é obrigatório.

Se n8n parar, o pedido fica salvo. O evento está na mesma transação do pedido, e o dispatcher tenta enviá-lo de novo. Após cinco tentativas, o erro fica visível para o administrador. Um retorno HTTP não é tratado como entrega da notificação.

## Dez perguntas prováveis

1. **Por que Clerk e Convex?** São exigidos no desafio. Clerk separa identidade de dados de negócio; Convex oferece funções autenticadas, dados reativos e transações.
2. **Onde estão as permissões?** Nas queries e mutations do Convex, usando `ctx.auth.getUserIdentity()` e o papel armazenado no perfil. A interface apenas orienta o usuário.
3. **Como alguém vira admin?** Um operador autorizado executa uma função interna. Não existe promoção pelo navegador nem regra de “primeiro usuário”.
4. **Como evita dupla reserva?** Verificação de intervalos inclusivos e escrita da revisão compartilhada dentro da mesma transação serializável.
5. **Por que não um booleano disponível?** Um booleano não representa reservas futuras. A disponibilidade deriva dos empréstimos aprovados e suas datas.
6. **Como lida com n8n indisponível?** Outbox durável, tentativas limitadas, leases, estados observáveis e reexecução administrativa.
7. **É exactly once?** Não. O resultado lógico é idempotente, mas um log/provedor pode executar antes de um crash. Precisamos de idempotência também no provedor real.
8. **O que fica público?** Apenas nome e categoria das ferramentas disponíveis. Essa restrição ocorre na resposta da query pública.
9. **O que os testes comprovam?** Regras de negócio, autorização com identidade simulada, assinaturas e contratos dos scripts de workflow. Não comprovam login real, runtime n8n ou comportamento de concorrência do serviço implantado.
10. **O que faria para produção?** Validaria as integrações, separaria ambientes, endureceria n8n, adicionaria rate limits, paginação, provedor real, alertas, backup/restauração e retenção/eliminação.

## Exercícios para Lucas

- Altere o máximo de dias permitido e atualize o teste de borda. Explique por que a validação deve continuar no backend.
- Adicione uma categoria em `lib/domain.ts` e `convex/schema.ts`. Veja o impacto nos formulários e no banco.
- Escreva um teste que confirme que um estranho não consegue cancelar o pedido de outra pessoa.
- Mude a política de devolução para aceitar também o tomador **apenas em uma branch de estudo**; explique o risco e atualize backend, UI, testes e documentação juntos.
- Inspecione uma assinatura inválida e identifique qual parte do contrato foi alterada, sem registrar segredos.
- Derrube a instância de teste do n8n, crie um pedido, reinicie e acompanhe o mesmo evento.

## Resumo em inglês para praticar

“LendLoop is a small neighborhood tool-lending application. Clerk handles sign-in, while Convex validates the user identity and enforces access rules for every operation. Borrow requests and notification events are saved together. n8n processes signed events and runs overdue reminders. Retries are bounded, and callbacks are idempotent. Notifications are currently logged mocks. I used an AI coding assistant for implementation and tests, and I am reviewing the decisions and practicing changes so I can explain the system clearly.”

Depois da verificação real, acrescente somente o que tiver demonstrado. Não diga que você domina Clerk, Convex ou AWS em produção sem essa experiência.

## Autoria e decisões

Lucas definiu o objetivo da candidatura, a stack pelo anúncio, o desenvolvimento local primeiro e o repositório privado. O assistente propôs a política de datas UTC, a devolução confirmada pelo dono, as leases/retries e o layout. Essas escolhas ainda precisam da revisão e compreensão de Lucas. Usar IA é permitido no anúncio; não esconda a assistência nem atribua revisão humana a etapas que ainda não fez.
