FROM node:20-slim

LABEL org.opencontainers.image.source="https://github.com/shipgate/shipgate"
LABEL org.opencontainers.image.description="Shipgate ISL Verify — behavioral verification for AI-generated code"
LABEL org.opencontainers.image.licenses="MIT"

RUN npm install -g shipgate

ENTRYPOINT ["shipgate"]
CMD ["verify", "--ci", "--json"]
