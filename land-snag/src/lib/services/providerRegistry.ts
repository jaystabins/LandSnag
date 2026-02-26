import { PropertyProvider } from './propertyProvider';
import { MockProvider } from './mockProvider';
import { ExampleTaxSaleProvider } from './taxSaleProvider';

export function getProviders(): PropertyProvider[] {
    return [
        new MockProvider(process.env.PROPERTY_API_KEY || 'demo-key'),
        new ExampleTaxSaleProvider()
    ];
}
