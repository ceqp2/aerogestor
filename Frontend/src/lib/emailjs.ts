import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '';
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? '';

export async function enviarEmailAcesso(params: {
  nomeDestinatario: string;
  emailDestinatario: string;
  senhaTemporaria: string;
  urlSistema: string;
}) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) return;
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_name: params.nomeDestinatario,
      to_email: params.emailDestinatario,
      senha_temporaria: params.senhaTemporaria,
      url_sistema: params.urlSistema,
    },
    { publicKey: PUBLIC_KEY },
  );
}
