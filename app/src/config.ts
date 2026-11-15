function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  apyUrl: requireEnv('APY_URL'),
  ltUrl: requireEnv('LT_URL'),
} as const;