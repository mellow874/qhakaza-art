import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';

import { prisma } from '../src/client';

/**
 * Change a staff account's email address or password.
 *
 *   npx tsx packages/shared-db/scripts/set-credentials.ts <current-email> \
 *     --email <new-email> --password <new-password>
 *
 * WHY A SCRIPT RATHER THAN A ONE-OFF QUERY.
 *
 * The password has to be hashed the same way the sign-in path hashes it -
 * bcrypt at cost 10, matching `seed.ts` and `server.ts`. A hand-written UPDATE
 * that stores the password in plain text, or hashes it differently, produces
 * an account that cannot sign in and gives no clue why. This keeps the one
 * detail that must match in the same place as everything else.
 *
 * THE ROW IS UPDATED, NOT REPLACED. Changing an email by deleting the user and
 * creating another would sever every AuditLog entry, InternalNote and
 * ReadinessAssessment attributed to them - the record would still exist but
 * would no longer point at anybody. The id is what those reference, so the id
 * is what is preserved.
 *
 * It asks before writing, and never prints the password back.
 */

type Options = { email?: string; password?: string; force: boolean };

function parse(argv: string[]): { target: string; options: Options } {
  const [target, ...rest] = argv;
  const options: Options = { force: false };

  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === '--email') options.email = rest[++index];
    else if (flag === '--password') options.password = rest[++index];
    else if (flag === '--force') options.force = true;
  }

  return { target, options };
}

async function main() {
  const { target, options } = parse(process.argv.slice(2));

  if (!target || (!options.email && !options.password)) {
    console.error(
      'Usage: set-credentials.ts <current-email> [--email <new>] [--password <new>] [--force]\n',
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email: target },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    console.error(`No account with the email ${target}.`);
    process.exit(1);
  }

  // Refuse to collide with an existing account rather than failing on the
  // unique constraint halfway through.
  if (options.email && options.email !== user.email) {
    const taken = await prisma.user.findUnique({
      where: { email: options.email },
      select: { id: true },
    });
    if (taken) {
      console.error(`${options.email} is already in use by another account.`);
      process.exit(1);
    }
  }

  console.log(`\n  Account: ${user.email}  (${user.role})`);
  if (options.email) console.log(`  Email    -> ${options.email}`);
  if (options.password) console.log('  Password -> (will be reset)');

  if (!options.force) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('\n  Apply this change? [y/N] ');
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') {
      console.log('  Cancelled. Nothing was written.\n');
      return;
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(options.email ? { email: options.email } : {}),
      // Cost 10, the same as seed.ts and what server.ts compares against.
      ...(options.password ? { passwordHash: await bcrypt.hash(options.password, 10) } : {}),
    },
  });

  console.log('\n  Done. Sign in with the new details to confirm.\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
