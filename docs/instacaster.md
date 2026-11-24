# Instacaster no Persiste

A aba fica em **Gestão → Instacaster** e usa o saldo e o histórico compartilhados da conta do provedor. Somente administradores aprovados têm acesso à aba e à função. A integração usa apenas o produto `ig_gmail_otp`.

## Configuração

1. No painel do projeto Supabase, abra **Edge Functions → Secrets** e crie `INSTACASTER_API_KEY` com a chave ativa do provedor.
2. Publique a função `instacaster` com a configuração de JWT versionada em `supabase/config.toml`.
3. Publique a interface. Com uma sessão de administrador, abra a aba e confira saldo, preço e histórico.

Os preços e as prioridades vêm do catálogo do Instacaster. A função confere a cotação antes de enviar a compra. Se a resposta de compra falhar após o envio, atualize o histórico antes de tentar novamente. Use **Consultar código** para verificar se chegou um código novo. Os códigos anteriores aparecem no histórico do pedido.
