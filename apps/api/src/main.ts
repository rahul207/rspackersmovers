import { EnvValidationError, loadEnv } from './config/env';
import { buildApp } from './server';

const DAY_MS = 24 * 60 * 60 * 1000;

async function main() {
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(error.message);
      console.error('\nCopy .env.example to .env and fix the values listed above.');
      process.exit(1);
    }
    throw error;
  }

  const { app, container } = await buildApp(env);

  // Storage files are created on first use; fail fast if any workbook cannot be opened.
  await Promise.all([
    container.repositories.quotes.ping(),
    container.repositories.contacts.ping(),
    container.repositories.consents.ping(),
    container.repositories.visitors.ping(),
  ]);

  const purge = () =>
    container.useCases.purgeExpired.execute().catch((error: unknown) => {
      app.log.error({ event: 'retention.failed', err: { message: (error as Error).message } });
    });
  void purge();
  const timer = setInterval(() => void purge(), DAY_MS);
  timer.unref();

  const shutdown = async (signal: string) => {
    app.log.info({ event: 'shutdown', signal });
    clearInterval(timer);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
