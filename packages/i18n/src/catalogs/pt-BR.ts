/**
 * Português do Brasil.
 *
 * Typed against `en`, so a key added there and forgotten here does not compile.
 * The holes are part of the translation: moving `{oldEmail}` inside the sentence
 * is expected, dropping it is a bug, and `check` fails on the second.
 */
import type { Catalog } from "./en";

export const ptBR: Catalog = {
  "mail.footer": "{brand} · {host}",
  "mail.orPaste": "Ou cole este endereço no seu navegador:",

  "mail.welcome.subject": "Bem-vindo à {brand}",
  "mail.welcome.title": "Sua conta está pronta",
  "mail.welcome.preview": "Dê um nome a um espaço de trabalho para continuar.",
  "mail.welcome.lead": "Dê um nome a um espaço de trabalho para continuar.",
  "mail.welcome.confirm":
    "Confirme que este endereço é seu para que possamos falar com você sobre a conta.",

  "mail.verify.subject": "Confirme seu e-mail da {brand}",
  "mail.verify.title": "Confirme seu e-mail",
  "mail.verify.preview": "O link funciona uma vez e expira em {days} dias.",
  "mail.verify.button": "Confirmar e-mail",
  "mail.verify.expiry": "O link funciona uma vez e expira em {days} dias.",

  "mail.reset.subject": "Redefina sua senha da {brand}",
  "mail.reset.title": "Redefina sua senha",
  "mail.reset.preview":
    "O link funciona uma vez e expira em {minutes} minutos.",
  "mail.reset.button": "Escolher uma nova senha",
  "mail.reset.expiry": "Expira em {minutes} minutos e funciona uma vez.",
  "mail.reset.ignore":
    "Se você não pediu isto, nada mudou e pode ignorar esta mensagem.",

  "mail.changeConfirm.subject": "Confirme seu novo e-mail da {brand}",
  "mail.changeConfirm.title": "Confirme seu novo e-mail",
  "mail.changeConfirm.preview":
    "Enquanto isto não for usado, {oldEmail} continua sendo o endereço da conta.",
  "mail.changeConfirm.lead":
    "Confirme este endereço para que a {brand} mova {oldEmail} para ele.",
  "mail.changeConfirm.button": "Confirmar este endereço",
  "mail.changeConfirm.expiry":
    "O link funciona uma vez e expira em {hours} horas. Até lá, {oldEmail} continua sendo o endereço da conta.",

  "mail.changeNotice.subject":
    "O e-mail da sua conta {brand} está sendo alterado",
  "mail.changeNotice.title": "O e-mail da sua conta está sendo alterado",
  "mail.changeNotice.preview":
    "Nada mudou ainda. {oldEmail} continua entrando na conta.",
  "mail.changeNotice.lead":
    "Alguém pediu para trocar o e-mail desta conta para {newEmail}.",
  "mail.changeNotice.body":
    "Nada mudou ainda — {oldEmail} continua entrando na conta, e a troca só acontece se o novo endereço confirmar.",
  "mail.changeNotice.warn":
    "Se não foi você, troque sua senha agora. Isso cancela o pedido e encerra todas as outras sessões.",

  "mail.changed.subject": "O e-mail da sua conta {brand} foi alterado",
  "mail.changed.title": "O e-mail da sua conta foi alterado",
  "mail.changed.preview": "Esta conta agora entra como {newEmail}.",
  "mail.changed.lead": "Esta conta agora entra como {newEmail}.",
  "mail.changed.body":
    "{oldEmail} não alcança mais esta conta, nem para redefinir a senha.",
  "mail.changed.warn":
    "Se não foi você, fale com o suporte — não dá mais para desfazer isto por aqui.",

  // ---- The shell ---------------------------------------------------------

  "app.loading": "Carregando…",
  "app.configMissing": "config.json ausente — rode scripts/render-brand.sh",
  "app.broke": "Algo quebrou",
  "nav.open": "Abrir menu",
  "nav.close": "Fechar menu",
  "dialog.cancel": "Cancelar",

  // ---- Account -----------------------------------------------------------

  "account.title": "Conta",
  "account.description": "Este login. O tema vale só para este navegador.",
  "account.operatorDescription":
    "O login deste operador. O tema vale só para este navegador.",

  "account.photo.label": "Foto",
  "account.photo.upload": "Enviar foto",
  "account.photo.uploading": "Enviando…",
  "account.photo.updated": "Foto atualizada",
  "account.photo.wrongType": "A foto precisa ser JPEG, PNG ou WebP.",
  "account.photo.tooBig": "A foto precisa ter no máximo 5 MB.",
  "account.name": "Nome",
  "account.username": "Nome de usuário",
  "account.save": "Salvar perfil",
  "account.saving": "Salvando…",
  "account.saved": "Perfil salvo",

  "account.email.title": "E-mail",
  "account.email.blurb":
    "Você entra com {email}, e é para lá que vai a redefinição de senha.",
  "account.email.sent":
    "Procure o link em {newEmail}. Nada mudou ainda — {email} continua funcionando até esse link ser usado.",
  "account.email.new": "Novo e-mail",
  "account.email.password": "Senha",
  "account.email.submit": "Trocar e-mail",
  "account.email.sending": "Enviando…",

  "account.password.title": "Senha",
  "account.password.current": "Atual",
  "account.password.new": "Nova",
  "account.password.submit": "Atualizar senha",
  "account.password.pending": "Atualizando…",
  "account.password.updated": "Senha atualizada",

  "account.language.title": "Idioma",
  "account.appearance.title": "Aparência",
  "theme.light": "Claro",
  "theme.system": "Sistema",
  "theme.dark": "Escuro",
  "theme.hint": "Este navegador. O padrão segue o dispositivo.",

  "account.close.title": "Encerrar conta",
  "account.close.blurb":
    "Apaga este login e os espaços de trabalho que só você tem.",
  "account.close.password": "Senha",
  "account.close.confirmTitle": "Encerrar esta conta?",
  "account.close.confirmBody":
    "Isto apaga {email} e todo espaço de trabalho de que você é o único dono. Espaços com outros membros continuam. Não dá para desfazer.",
  "account.close.pending": "Encerrando…",

  // ---- Sessions ----------------------------------------------------------

  "sessions.title": "Onde você está conectado",
  "sessions.blurb":
    "Entrar em outro dispositivo não encerra este. Encerre qualquer um que você não reconheça.",
  "sessions.support": " · suporte",
  "sessions.device": "{browser} no {system}",
  "sessions.unknownDevice": "Dispositivo desconhecido",
  "sessions.thisDevice": "Este dispositivo",
  "sessions.lastUsed": "Usado {ago}",
  "sessions.justNow": "agora mesmo",
  "sessions.end": "Encerrar",
  "sessions.ending": "Encerrando…",
  "sessions.ended": "Sessão encerrada",
  "sessions.revokeOthers": "Sair de todos os outros",
  "sessions.revokeOthers.done": "Você saiu de todos os outros",
  "sessions.revokeOthers.confirmTitle": "Sair de todos os outros?",
  "sessions.revokeOthers.confirmBody.one":
    "Isto encerra {n} outra sessão. Este dispositivo continua conectado. Quem estiver usando aquele dispositivo terá que entrar de novo.",
  "sessions.revokeOthers.confirmBody.other":
    "Isto encerra {n} outras sessões. Este dispositivo continua conectado. Quem estiver usando esses dispositivos terá que entrar de novo.",

  // ---- Auth --------------------------------------------------------------

  "auth.signIn": "Entrar",
  "auth.signIn.description": "E-mail e senha.",
  "auth.signIn.pending": "Entrando…",
  "auth.signOut": "Sair",
  "auth.email": "E-mail",
  "auth.password": "Senha",
  "auth.passwordAgain": "Repita a senha",
  "auth.passwordMismatch": "As duas senhas são diferentes.",
  "auth.noAccount": "Não tem conta?",
  "auth.createOne": "Crie uma",
  "auth.haveAccount": "Já tem uma conta?",
  "auth.forgot": "Esqueceu?",
  "auth.backToSignIn": "Voltar para entrar",
  "auth.goToSignIn": "Ir para o login",

  "signup.title": "Criar conta",
  "signup.description": "Um e-mail e uma senha. Nada além disso.",
  "signup.submit": "Criar conta",
  "signup.pending": "Criando…",
  "signup.invalid": "Um endereço de e-mail e uma senha de pelo menos 8 caracteres.",

  "forgot.title": "Redefina sua senha",
  "forgot.description": "Enviaremos um link por e-mail.",
  "forgot.submit": "Enviar o link",
  "forgot.pending": "Enviando…",
  "forgot.sentTitle": "Verifique seu e-mail",
  "forgot.sentDescription":
    "Se esse endereço tiver uma conta, um link de redefinição está a caminho.",
  "forgot.sentBody":
    "O link funciona uma vez e expira em 30 minutos. Nada muda até você usá-lo.",

  "reset.title": "Escolha uma nova senha",
  "reset.description":
    "Pelo menos 8 caracteres. Isto encerra todas as sessões conectadas.",
  "reset.password": "Nova senha",
  "reset.confirm": "Repita",
  "reset.submit": "Definir a senha",
  "reset.pending": "Salvando…",
  "reset.done": "Senha alterada",
  "reset.noTokenTitle": "Este link está incompleto",
  "reset.noTokenDescription":
    "Links de redefinição carregam um código. Peça um novo.",
  "reset.newLink": "Enviar um novo link",

  "verify.working": "Confirmando…",
  "verify.doneTitle": "E-mail confirmado",
  "verify.doneDescription":
    "Este é o endereço que usaremos para falar com você.",
  "verify.failedTitle": "Não deu para confirmar esse endereço",
  "verify.failedDescription":
    "Links de confirmação valem uma vez e expiram em três dias.",
  "verify.noToken": "Este link não tem código. Peça um novo na sua conta.",
  "verify.banner": "Confirme {email} — veja sua caixa de entrada.",
  "verify.resend": "Enviar de novo",
  "verify.resending": "Enviando…",
  "verify.resent": "Confirmação enviada",

  "emailChange.doneTitle": "E-mail alterado",
  "emailChange.doneDescription":
    "É com este endereço que você entra agora, e é ele que redefine sua senha.",
  "emailChange.failedTitle": "Não deu para trocar esse endereço",
  "emailChange.failedDescription":
    "Estes links valem uma vez e expiram em duas horas. Trocar a senha cancela todos eles.",

  "handoff.working": "Abrindo o espaço de trabalho…",
  "handoff.failedTitle": "Não deu para abrir esse espaço de trabalho",
  "handoff.failedDescription":
    "Links de acesso valem uma vez e expiram em um minuto.",
  "handoff.noToken":
    "Este link não tem código de acesso. Comece de novo pelo console.",

  "common.continue": "Continuar",

  // ---- Workspaces --------------------------------------------------------

  "org.createTitle": "Falta um passo",
  "org.createDescription": "Um nome para você, e um nome para o seu espaço de trabalho.",
  "org.yourNameHint": "Opcional — é como o produto vai se dirigir a você.",
  "org.name": "Nome do espaço de trabalho",
  "org.creating": "Criando…",
  "org.fallback": "Espaço de trabalho",
  "org.switching": "Trocando…",
  "org.new": "Novo espaço de trabalho",
  "org.add": "Adicionar",
  "org.adding": "Adicionando…",
  "org.created": "Espaço de trabalho criado",

  "home.title": "Início",
  "home.empty": "Ainda não há nada neste espaço de trabalho.",
  "notFound.title": "Não encontrado",
  "notFound.back": "Voltar ao início",

  "support.viewingAs": "Vendo como {org}",
  "support.stop": "Parar",
  "support.stopping": "Parando…",

  // ---- The console -------------------------------------------------------

  "admin.title": "Admin",
  "admin.signIn.description": "Somente operadores da plataforma.",
  "admin.redirecting": "Redirecionando…",
  "admin.operator": "Operador",
  "admin.nav.overview": "Visão geral",
  "admin.nav.users": "Usuários",
  "admin.nav.orgs": "Espaços de trabalho",
  "admin.nav.lab": "Laboratório",
  "admin.nav.mail": "E-mail",
  "admin.nav.objects": "Objetos",
  "admin.nav.db": "Banco de dados",

  "admin.overview.title": "Visão geral",
  "admin.overview.description": "Esta instalação.",

  "admin.users.title": "Usuários",
  "admin.users.description": "Todos os logins desta instalação.",
  "admin.users.error": "Não deu para carregar os usuários.",
  "admin.users.email": "E-mail",
  "admin.users.username": "Nome de usuário",
  "admin.users.role": "Papel",
  "admin.users.roleAdmin": "Admin",
  "admin.users.roleMember": "Membro",

  "admin.orgs.title": "Espaços de trabalho",
  "admin.orgs.description":
    "O suporte vê um espaço de trabalho sem tomar a sessão de quem é dono.",
  "admin.orgs.error": "Não deu para carregar os espaços de trabalho.",
  "admin.orgs.name": "Nome",
  "admin.orgs.viewAs": "Ver como",
  "admin.orgs.opening": "Abrindo…",
  "admin.notFound.back": "Voltar à visão geral",

  // ---- The marketing site ------------------------------------------------

  "www.nav.product": "Produto",
  "www.nav.surfaces": "Superfícies",
  "www.getStarted": "Começar",
  "www.eyebrow": "Estrutura independente",
  "www.headline": "Casco e acabamento do app. Sem negócio embutido.",
  "www.sub":
    "Clone, rode o script de instalação, o Docker faz o resto. O cadastro é nome de usuário, e-mail e senha. Depois, um nome de espaço de trabalho.",
  "www.seeSurfaces": "Ver as superfícies",
  "www.edge.title": "Borda própria",
  "www.edge.body":
    "Traefik, certificados e hosts moram neste repositório. Nada na máquina além do Docker.",
  "www.userOrg.title": "Usuário + espaço",
  "www.userOrg.body":
    "Um login, muitos espaços de trabalho. O isolamento é o org_id. O suporte vê um espaço sem roubar a sessão.",
  "www.module.title": "Encaixe de módulo",
  "www.module.body":
    "A página inicial é vazia de propósito. Um módulo de produto a preenche. O casco não sabe o que você vende.",
  "www.surfaces.title": "Três hosts",
  "www.surfaces.www": "Esta página. Sem cookie.",
  "www.surfaces.app": "O casco do produto.",
  "www.surfaces.admin": "Operadores da instalação.",
  "www.open": "Abrir",

  // ---- What the server says went wrong -----------------------------------

  "error.emailTaken": "Este e-mail já está em uso.",
  "error.usernameTaken": "Este nome de usuário já está em uso.",
  "error.emailRequired": "Informe um endereço de e-mail.",
  "error.usernameInvalid": "O nome de usuário precisa ter de 3 a 24 letras, números ou _.",
  "error.passwordTooShort": "A senha precisa ter pelo menos 8 caracteres.",
  "error.nameTooLong": "Este nome é longo demais.",
  "error.orgNameRequired": "Informe um nome para o espaço de trabalho.",
  "error.sameEmail": "Este já é o seu endereço.",
  "error.credentialsInvalid": "E-mail ou senha incorretos.",
  "error.passwordWrong": "Esta senha está incorreta.",
  "error.currentPasswordWrong": "Sua senha atual está incorreta.",
  "error.resetInvalid": "Este link de redefinição é inválido ou expirou.",
  "error.verifyInvalid": "Este link de confirmação é inválido ou expirou.",
  "error.linkInvalid": "Este link é inválido ou expirou.",
  "error.handoffInvalid": "Este link de acesso é inválido ou expirou.",
  "error.sessionNotFound": "Esta sessão já não existe.",
  "error.orgNotFound": "Este espaço de trabalho não existe mais.",
  "error.adminRequired": "Isto exige um operador da plataforma.",
  "error.adminCannotClose": "Um operador da plataforma não pode encerrar a própria conta.",
  "error.photoType": "A foto precisa ser JPEG, PNG ou WebP.",
  "error.photoTooLarge": "A foto é grande demais.",
  "error.photoUnreadable": "Não deu para ler esta foto.",
  "error.photoNotFound": "Sem foto.",
  "error.storageOff": "O armazenamento de objetos não está configurado.",
  "error.unauthenticated": "Entre novamente.",
  "error.notFound": "Não encontrado.",
  "error.server": "Algo deu errado do nosso lado.",
  "error.requestFailed": "A requisição falhou.",
  "error.rateLimited": "Tentativas demais. Tente de novo em {seconds}s.",
  "error.rateLimitedSoon": "Tentativas demais. Tente de novo daqui a pouco.",
};
