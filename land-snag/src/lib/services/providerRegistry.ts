import { PropertyProvider } from './propertyProvider';
// import { MockProvider } from './mockProvider';
// import { ExampleTaxSaleProvider } from './taxSaleProvider';
import { RealtorProvider } from '@/providers/RealtorProvider';

export function getProviders(): PropertyProvider[] {
    const providers: PropertyProvider[] = [
        new RealtorProvider()
    ];

    if (process.env.ENABLE_MOCKS === 'true') {
        // providers.push(new MockProvider(process.env.PROPERTY_API_KEY || 'demo-key'));
        // providers.push(new ExampleTaxSaleProvider());
    }

    return providers;
}
