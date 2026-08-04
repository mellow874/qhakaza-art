import { ArtStatus, OrderStatus, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Every seeded account shares this password — local development only. */
const SEED_PASSWORD = 'password123';

const IMAGE = (seed: string) => `https://picsum.photos/seed/${seed}/1200/1500`;

async function main() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);

  // Idempotent: wipe in FK-safe order so `npm run db:seed` can be re-run.
  await prisma.favorite.deleteMany();
  await prisma.order.deleteMany();
  await prisma.artwork.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: 'Nomsa Dlamini',
      email: 'admin@qhakaza.art',
      role: Role.ADMIN,
      passwordHash,
      bio: 'Platform administrator.',
    },
  });

  const [thandi, sipho] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Thandi Mokoena',
        email: 'thandi@qhakaza.art',
        role: Role.ARTIST,
        passwordHash,
        bio: 'Painter working in oil and ochre pigment.',
        artist: {
          create: {
            displayName: 'Thandi Mokoena',
            slug: 'thandi-mokoena',
            statement: 'I paint the light of the highveld — the hour just before a summer storm.',
            socials: { instagram: 'https://instagram.com/thandi.paints' },
            approved: true,
          },
        },
      },
      include: { artist: true },
    }),
    prisma.user.create({
      data: {
        name: 'Sipho Ndlovu',
        email: 'sipho@qhakaza.art',
        role: Role.ARTIST,
        passwordHash,
        bio: 'Printmaker and sculptor.',
        artist: {
          create: {
            displayName: 'Sipho Ndlovu Studio',
            slug: 'sipho-ndlovu',
            statement: 'Linocut and reclaimed steel. Work about labour, memory and the city.',
            socials: { instagram: 'https://instagram.com/sipho.studio' },
            // Left unapproved on purpose, so admin approval has something to act on.
            approved: false,
          },
        },
      },
      include: { artist: true },
    }),
  ]);

  const collectors = await Promise.all(
    [
      { name: 'Lerato Khumalo', email: 'lerato@example.com' },
      { name: 'James Petersen', email: 'james@example.com' },
      { name: 'Aisha Patel', email: 'aisha@example.com' },
    ].map((collector) =>
      prisma.user.create({
        data: { ...collector, role: Role.COLLECTOR, passwordHash },
      }),
    ),
  );

  const thandiProfileId = thandi.artist!.id;
  const siphoProfileId = sipho.artist!.id;

  // Ten pieces across a mix of statuses, so browse, drafts, sold and moderation
  // states all have data from the first run.
  const pieces = [
    {
      artistId: thandiProfileId,
      title: 'Ubuntu in Ochre',
      medium: 'Oil on canvas',
      dimensions: '900 x 1200 mm',
      price: 18500,
      status: ArtStatus.LISTED,
    },
    {
      artistId: thandiProfileId,
      title: 'Highveld Storm I',
      medium: 'Oil on canvas',
      dimensions: '600 x 900 mm',
      price: 12500,
      status: ArtStatus.LISTED,
    },
    {
      artistId: thandiProfileId,
      title: 'Highveld Storm II',
      medium: 'Oil on canvas',
      dimensions: '600 x 900 mm',
      price: 12500,
      status: ArtStatus.SOLD,
    },
    {
      artistId: thandiProfileId,
      title: 'Morning, Soweto',
      medium: 'Acrylic on board',
      dimensions: '400 x 400 mm',
      price: 6800,
      status: ArtStatus.LISTED,
    },
    {
      artistId: thandiProfileId,
      title: 'Study in Red Earth',
      medium: 'Charcoal and pigment on paper',
      dimensions: '300 x 420 mm',
      price: 3200,
      status: ArtStatus.DRAFT,
    },
    {
      artistId: siphoProfileId,
      title: 'Shift Change',
      medium: 'Linocut on cotton rag',
      dimensions: '500 x 700 mm',
      price: 4500,
      status: ArtStatus.LISTED,
    },
    {
      artistId: siphoProfileId,
      title: 'Braamfontein Nocturne',
      medium: 'Linocut on cotton rag',
      dimensions: '500 x 700 mm',
      price: 4500,
      status: ArtStatus.LISTED,
    },
    {
      artistId: siphoProfileId,
      title: 'Scaffold',
      medium: 'Reclaimed steel',
      dimensions: '400 x 400 x 1100 mm',
      price: 32000,
      status: ArtStatus.LISTED,
    },
    {
      artistId: siphoProfileId,
      title: 'Untitled (Maquette)',
      medium: 'Reclaimed steel',
      dimensions: '150 x 150 x 300 mm',
      price: 7500,
      status: ArtStatus.DRAFT,
    },
    {
      artistId: siphoProfileId,
      title: 'Removed Work',
      medium: 'Mixed media',
      dimensions: '500 x 500 mm',
      price: 5000,
      status: ArtStatus.HIDDEN,
    },
  ];

  const created = [];
  for (const [index, piece] of pieces.entries()) {
    created.push(
      await prisma.artwork.create({
        data: {
          ...piece,
          description: `${piece.title} — ${piece.medium.toLowerCase()}, ${piece.dimensions}. Seeded sample work for local development.`,
          images: [IMAGE(`qhakaza-${index}`), IMAGE(`qhakaza-${index}-detail`)],
          currency: 'ZAR',
        },
      }),
    );
  }

  const soldPiece = created.find((piece) => piece.status === ArtStatus.SOLD)!;
  await prisma.order.create({
    data: {
      artworkId: soldPiece.id,
      collectorId: collectors[0].id,
      amount: soldPiece.price,
      currency: soldPiece.currency,
      status: OrderStatus.PAID,
      stripePaymentIntentId: 'pi_seed_paid_0001',
    },
  });

  const listed = created.filter((piece) => piece.status === ArtStatus.LISTED);
  await prisma.favorite.createMany({
    data: [
      { collectorId: collectors[0].id, artworkId: listed[0].id },
      { collectorId: collectors[0].id, artworkId: listed[2].id },
      { collectorId: collectors[1].id, artworkId: listed[1].id },
    ],
  });

  console.log('Seeded:');
  console.log(`  1 admin       ${admin.email}`);
  console.log(`  2 artists     ${thandi.email}, ${sipho.email} (sipho awaits approval)`);
  console.log(`  3 collectors  ${collectors.map((c) => c.email).join(', ')}`);
  console.log(`  ${created.length} art pieces, 1 paid order, 3 favourites`);
  console.log(`  password for every account: ${SEED_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
