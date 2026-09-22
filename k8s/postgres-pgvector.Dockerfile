# postgres:16-alpine + pgvector — keeps the SAME musl/alpine base as the running
# DB so libc collation is unchanged (no glibc switch → text indexes stay valid).
# Only adds the pgvector extension .so; PGDATA format is untouched.
FROM postgres:16-alpine
RUN set -eux; \
    apk add --no-cache --virtual .build-deps build-base clang19 llvm19-dev git; \
    git clone --branch v0.8.0 --depth 1 https://github.com/pgvector/pgvector.git /tmp/pgvector; \
    cd /tmp/pgvector; \
    make; \
    make install; \
    cd /; \
    apk del .build-deps; \
    rm -rf /tmp/pgvector
