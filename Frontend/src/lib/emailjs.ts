import emailjs from '@emailjs/browser';

export async function enviarEmailAcesso(params: {
  nomeDestinatario: string;
  emailDestinatario: string;
  senhaTemporaria: string;
  urlSistema: string;
}) {
  const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID ?? '';
  const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? '';
  const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? '';

  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    console.error('[EmailJS] Variáveis de ambiente não configuradas. E-mail não enviado.');
    return;
  }

  try {
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
  } catch (err: unknown) {
    const detail = err && typeof err === 'object' && 'text' in err ? (err as { text: string }).text : String(err);
    console.error('[EmailJS] Erro ao enviar:', detail);
    throw err;
  }
}
