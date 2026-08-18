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
  "mail.reset.preview": "O link funciona uma vez e expira em {minutes} minutos.",
  "mail.reset.button": "Escolher uma nova senha",
  "mail.reset.expiry": "Expira em {minutes} minutos e funciona uma vez.",
  "mail.reset.ignore": "Se você não pediu isto, nada mudou e pode ignorar esta mensagem.",

  "mail.changeConfirm.subject": "Confirme seu novo e-mail da {brand}",
  "mail.changeConfirm.title": "Confirme seu novo e-mail",
  "mail.changeConfirm.preview":
    "Enquanto isto não for usado, {oldEmail} continua sendo o endereço da conta.",
  "mail.changeConfirm.lead":
    "Confirme este endereço para que a {brand} mova {oldEmail} para ele.",
  "mail.changeConfirm.button": "Confirmar este endereço",
  "mail.changeConfirm.expiry":
    "O link funciona uma vez e expira em {hours} horas. Até lá, {oldEmail} continua sendo o endereço da conta.",

  "mail.changeNotice.subject": "O e-mail da sua conta {brand} está sendo alterado",
  "mail.changeNotice.title": "O e-mail da sua conta está sendo alterado",
  "mail.changeNotice.preview": "Nada mudou ainda. {oldEmail} continua entrando na conta.",
  "mail.changeNotice.lead": "Alguém pediu para trocar o e-mail desta conta para {newEmail}.",
  "mail.changeNotice.body":
    "Nada mudou ainda — {oldEmail} continua entrando na conta, e a troca só acontece se o novo endereço confirmar.",
  "mail.changeNotice.warn":
    "Se não foi você, troque sua senha agora. Isso cancela o pedido e encerra todas as outras sessões.",

  "mail.changed.subject": "O e-mail da sua conta {brand} foi alterado",
  "mail.changed.title": "O e-mail da sua conta foi alterado",
  "mail.changed.preview": "Esta conta agora entra como {newEmail}.",
  "mail.changed.lead": "Esta conta agora entra como {newEmail}.",
  "mail.changed.body": "{oldEmail} não alcança mais esta conta, nem para redefinir a senha.",
  "mail.changed.warn":
    "Se não foi você, fale com o suporte — não dá mais para desfazer isto por aqui.",
};
