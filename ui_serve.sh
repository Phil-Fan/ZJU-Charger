cd frontend
pnpm install
pnpm build
pm2 start pnpm --name frontend -- start --port 3000