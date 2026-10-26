/** Leitura e validação das variáveis de ambiente. Falha cedo se algo essencial faltar. */
function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v.trim();
}
function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === '') return def;
  return v.toLowerCase() === 'true';
}
function int(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

export interface AppEnv {
  nodeEnv: string;
  isProd: boolean;
  port: number;
  appOrigin: string[];
  sessionSecret: string;
  dataKey: Buffer;
  sessionTtlHours: number;
  cookieSecure: boolean;
  mfaEnforcePrivileged: boolean;
  storageDriver: 'local' | 's3';
  storageLocalDir: string;
  uploadMaxBytes: number;
  pncpBaseUrl: string;
  comprasBaseUrl: string;
  integrationTimeoutMs: number;
  jobsEnabled: boolean;
}

let cached: AppEnv | null = null;

export function env(): AppEnv {
  if (cached) return cached;
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProd = nodeEnv === 'production';
  const sessionSecret = req('SESSION_SECRET');
  if (sessionSecret.length < 32) throw new Error('SESSION_SECRET deve ter ao menos 32 caracteres');
  const dataKey = Buffer.from(req('DATA_ENCRYPTION_KEY'), 'base64');
  if (dataKey.length !== 32) throw new Error('DATA_ENCRYPTION_KEY deve ter 32 bytes em base64');
  const cookieSecure = bool('COOKIE_SECURE', isProd);
  if (isProd && !cookieSecure) throw new Error('Em produção COOKIE_SECURE deve ser true');
  cached = {
    nodeEnv,
    isProd,
    port: int('PORT', 3000),
    appOrigin: req('APP_ORIGIN').split(',').map((s) => s.trim()),
    sessionSecret,
    dataKey,
    sessionTtlHours: int('SESSION_TTL_HOURS', 8),
    cookieSecure,
    mfaEnforcePrivileged: bool('MFA_ENFORCE_PRIVILEGED', isProd),
    storageDriver: (process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local'),
    storageLocalDir: process.env.STORAGE_LOCAL_DIR || './storage',
    uploadMaxBytes: int('UPLOAD_MAX_MB', 20) * 1024 * 1024,
    pncpBaseUrl: process.env.PNCP_BASE_URL || 'https://pncp.gov.br/api/consulta',
    comprasBaseUrl: process.env.COMPRAS_BASE_URL || 'https://dadosabertos.compras.gov.br',
    integrationTimeoutMs: int('INTEGRATION_TIMEOUT_MS', 15000),
    jobsEnabled: bool('JOBS_ENABLED', true),
  };
  return cached;
}
