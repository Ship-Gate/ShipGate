import { prisma } from '@/lib/prisma';

type OAuthUser = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
};

/**
 * Find or create a user + default org on OAuth login.
 * Returns the DB user record.
 */
export async function provisionUser(oauthUser: OAuthUser) {
  let user = await prisma.user.findUnique({ where: { email: oauthUser.email } });

  if (user) {
    // Update avatar/name if changed
    if (user.avatar !== oauthUser.avatar || user.name !== oauthUser.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { avatar: oauthUser.avatar, name: oauthUser.name },
      });
    }
    return user;
  }

  // Create user + default personal org
  user = await prisma.user.create({
    data: {
      email: oauthUser.email,
      name: oauthUser.name,
      avatar: oauthUser.avatar,
      provider: oauthUser.provider,
      providerAccountId: oauthUser.id,
    },
  });

  const orgName = `${user.name ?? user.email}'s Workspace`;
  const org = await prisma.org.create({ data: { name: orgName } });
  await prisma.membership.create({
    data: { userId: user.id, orgId: org.id, role: 'admin' },
  });

  return user;
}
