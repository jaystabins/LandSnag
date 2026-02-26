import { RealtorProvider } from '../src/providers/RealtorProvider';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    if (process.env.NODE_ENV === 'production') {
        console.error('This script cannot be run in production.');
        process.exit(1);
    }

    const args = process.argv.slice(2);
    const bboxIdx = args.indexOf('-b');

    if (bboxIdx === -1 || !args[bboxIdx + 1]) {
        console.error('Usage: ts-node scripts/check-realtor.ts -b "west,south,east,north"');
        process.exit(1);
    }

    const bboxStr = args[bboxIdx + 1];
    const bbox = bboxStr.split(',').map(Number) as [number, number, number, number];

    if (bbox.length !== 4 || bbox.some(isNaN)) {
        console.error('Invalid bbox format. Use "west,south,east,north".');
        process.exit(1);
    }

    console.log(`[CheckRealtor] Searching bbox: ${JSON.stringify(bbox)}`);

    const provider = new RealtorProvider();
    try {
        const results = await provider.search({ bbox });
        console.log(`[CheckRealtor] SUCCESS: Found ${results.length} listings.`);

        if (results.length > 0) {
            console.log('[CheckRealtor] First result snippet:');
            console.log(JSON.stringify(results[0].properties, null, 2).substring(0, 500) + '...');
        }
    } catch (error) {
        console.error('[CheckRealtor] ERROR:', error);
    }
}

run();
