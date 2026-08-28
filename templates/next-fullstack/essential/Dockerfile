FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM dependencies AS build
COPY . .
RUN npm run db:generate && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/.next ./.next
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "run", "start"]
