import 'dotenv/config';
import { createServerApp } from './server/app.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const { app, isProd } = await createServerApp();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`,
    );
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
