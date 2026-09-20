FROM golang:alpine AS builder
WORKDIR /app
COPY backend/ .
RUN go mod tidy && \
    CGO_ENABLED=0 go build -o server ./cmd/server && \
    CGO_ENABLED=0 go build -o mcp-server ./cmd/mcp-server

FROM alpine:3.19
# yt-dlp's EJS JS-challenge solver requires Node >= 22 (Alpine 3.19's apk nodejs is 20.x, too old) —
# grab a working musl-built Node 22 binary straight from the official node:22-alpine image instead.
COPY --from=node:22-alpine /usr/local/bin/node /usr/local/bin/node
RUN apk add --no-cache ffmpeg poppler-utils wget ca-certificates python3 tesseract-ocr tesseract-ocr-data-eng traceroute libstdc++ && \
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    echo "--js-runtimes node" > /etc/yt-dlp.conf
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/mcp-server .
RUN mkdir -p data
EXPOSE 8080
CMD ["./server"]
