FROM golang:alpine AS builder
WORKDIR /app
COPY backend/ .
RUN go mod tidy && \
    CGO_ENABLED=0 go build -o server ./cmd/server && \
    CGO_ENABLED=0 go build -o mcp-server ./cmd/mcp-server

FROM alpine:3.19
RUN apk add --no-cache ffmpeg poppler-utils wget ca-certificates python3 tesseract-ocr tesseract-ocr-data-eng && \
    wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/mcp-server .
RUN mkdir -p data
EXPOSE 8080
CMD ["./server"]
