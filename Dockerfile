FROM node:latest

ENV PNPM_HOME="/pnpm"

ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

ENV PLAYWRIGHT_BROWSERS_PATH=/app/node_modules/playwright/.local-browsers

COPY . .

RUN pnpm exec playwright install --with-deps chromium

EXPOSE 7860

CMD ["pnpm", "run", "dev"]