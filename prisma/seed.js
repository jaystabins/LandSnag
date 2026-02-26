const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding properties...');

    // Bounding box for mock data (Approximate Charlotte, NC area)
    const minLat = 35.1;
    const maxLat = 35.4;
    const minLng = -80.9;
    const maxLng = -80.7;

    const properties = [];
    if (process.env.SEED_MOCKS === 'true') {
        process.stdout.write('Generating 200 mock properties...\n');
        for (let i = 0; i < 200; i++) {
            const lat = Math.random() * (maxLat - minLat) + minLat;
            const lng = Math.random() * (maxLng - minLng) + minLng;
            const price = Math.floor(Math.random() * 900000) + 100000;
            const propertyType = Math.random() > 0.5 ? 'RESIDENTIAL' : 'LAND';

            properties.push({
                latitude: lat,
                longitude: lng,
                price: price,
                address: `${Math.floor(Math.random() * 9999)} Mock St`,
                city: 'Charlotte',
                state: 'NC',
                zip: '28202',
                propertyType: propertyType,
                lotSize: propertyType === 'LAND' ? Math.random() * 10 : null,
            });
        }
    }
    // Clear existing
    await prisma.property.deleteMany();

    // SQLite createMany is supported in Prisma 5+
    await prisma.property.createMany({
        data: properties,
    });

    console.log(`Seeded 200 properties.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
