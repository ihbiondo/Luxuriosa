# Redirecionamento do antigo Lux-Gestão

O painel administrativo foi transferido para o ambiente privado 442:

- Gestão e Vendas: https://442.luxuriosa.com.br/apps/gestao/
- Pedidos do Site: https://442.luxuriosa.com.br/apps/pedidos-site/
- Inteligência: https://442.luxuriosa.com.br/apps/inteligencia/

O Worker legado lux-gestao permanece apenas para compatibilidade com o endereço antigo /lux-gestao/. Ele serve uma página mínima que redireciona para o hostname privado. A autenticação e autorização acontecem no Cloudflare Access e no Supabase MFA do 442.

Não incluir lógica administrativa, código de Edge Functions, dados operacionais, tokens ou credenciais no repositório público. O código-fonte do backend está no repositório privado ihbiondo/442, em supabase/.

As URLs antigas de Pedidos e Inteligência também permanecem como redirecionamentos, preservando favoritos e links existentes. O site público continua responsável pela vitrine, conta do cliente, checkout e acompanhamento de pedidos.
