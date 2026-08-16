# syntax=docker/dockerfile:1.7
# Build context: repository root.
# ARG SHELL=www|web|admin
FROM public.ecr.aws/docker/library/node:20-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/www/package.json apps/www/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile
COPY . .
ARG SHELL=web
ARG VITE_HULL_HOST=hull.dev
ENV VITE_HULL_HOST=${VITE_HULL_HOST}
RUN pnpm --filter @hull/${SHELL} build

FROM nginx:1.27-alpine
ARG SHELL=web
COPY deploy/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/${SHELL}/dist /usr/share/nginx/html
EXPOSE 80
