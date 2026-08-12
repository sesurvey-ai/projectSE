FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npx tsc

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
# ไฟล์ .sql ไม่ได้ถูกคอมไพล์ไป dist/ — ต้องก๊อปแยก
# ไม่งั้นรัน migration บน prod ต้องพิมพ์ SQL ทั้งไฟล์ลงเทอร์มินัลเว็บของ Dokploy
# (seed เรทมี 400 บรรทัด พิมพ์มือคือหายนะ) มีไฟล์แล้วรันด้วยคำสั่งเดียวจากใน container
COPY --from=builder /app/src/db ./src/db
RUN mkdir -p /app/uploads
ENV NODE_ENV=production
ENV UPLOAD_DIR=/app/uploads
EXPOSE 3001
CMD ["node", "dist/index.js"]
