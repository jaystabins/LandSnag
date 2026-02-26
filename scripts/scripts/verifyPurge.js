const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Using raw query to avoid Any Prisma Client generation issues
    const result = await prisma.$queryRaw`SELECT COUNT(*) as count FROM "Property" WHERE "source" <> 'realtor16' OR "source" IS NULL`;
    const count = Number(result[0].count);

    console.log(`TOTAL MOCK RECORDS: ${count}`);
    if (count === 0) {
        console.log('SUCCESS: Database is clean of mock data.');
    } else {
        console.log('FAILURE: Mock data still exists!');
        process.exit(1);
    }
}

main().finally(() => prisma.$disconnect());
