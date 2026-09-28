# Entrar com Google

O Telektro inicia o OAuth pelo Supabase Auth e troca o código PKCE em `/auth/callback`. O segredo do Google fica somente na configuração do provedor no Supabase; não deve ser colocado em variáveis `NEXT_PUBLIC_*` nem enviado ao Git.

## Google Cloud

No projeto Google Cloud, abra **Google Auth Platform → Clients** e crie ou reutilize um cliente OAuth do tipo **Web application**.

- Authorized JavaScript origin para desenvolvimento: `http://127.0.0.1:3000`
- Authorized redirect URI: `https://ipgzatvoxcmzghantdqa.supabase.co/auth/v1/callback`

Copie o Client ID e o Client Secret. Se o consentimento OAuth estiver em modo de teste, inclua as contas que farão o teste como usuários de teste.

## Supabase

No projeto `ipgzatvoxcmzghantdqa`, abra **Authentication → Sign In / Providers → Google**, habilite o provedor e informe o Client ID e o Client Secret do Google. Em **Authentication → URL Configuration**, permita o callback da aplicação:

- `http://127.0.0.1:3000/auth/callback`
- `http://localhost:3000/auth/callback` (se acessar o app por `localhost`)

O `NEXT_PUBLIC_SITE_URL` local precisa corresponder ao endereço usado no navegador. Hoje o projeto usa `http://127.0.0.1:3000`.

O Client Secret é uma credencial persistente de OAuth. Insira-o somente no campo de segredo do provedor Google no painel Supabase. Não o compartilhe no chat, não o coloque em `.env.local` e não o versione.

## Teste local

Com o provedor habilitado e as URLs acima salvas, abra `http://127.0.0.1:3000/login` ou `/register` e escolha **Continuar com Google**. O retorno passa por `/auth/callback` e cria a sessão do Telektro.

Fonte: [documentação oficial do Supabase — Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google) e [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
