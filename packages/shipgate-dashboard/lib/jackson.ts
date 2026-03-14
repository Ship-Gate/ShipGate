import jackson, {
  type IOAuthController,
  type IConnectionAPIController,
  type JacksonOption,
} from '@boxyhq/saml-jackson';

const opts: JacksonOption = {
  externalUrl: process.env.NEXTAUTH_URL || 'http://localhost:3001',
  samlAudience: 'https://saml.shipgate.dev',
  samlPath: '/api/auth/saml/acs',
  db: {
    engine: 'sql',
    type: 'postgres',
    url: process.env.DATABASE_URL!,
  },
};

type JacksonInstance = {
  oauthController: IOAuthController;
  connectionAPIController: IConnectionAPIController;
};

const g = globalThis as typeof globalThis & { _jackson?: JacksonInstance };

export default async function getJackson(): Promise<JacksonInstance> {
  if (!g._jackson) {
    const ret = await jackson(opts);
    g._jackson = {
      oauthController: ret.oauthController,
      connectionAPIController: ret.connectionAPIController,
    };
  }
  return g._jackson;
}
