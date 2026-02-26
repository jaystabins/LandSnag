-- First delete dependent records to satisfy foreign key constraints
DELETE FROM "SavedProperty" WHERE "propertyId" IN (SELECT "id" FROM "Property" WHERE "source" <> 'realtor16' OR "source" IS NULL);
DELETE FROM "PropertyNote" WHERE "propertyId" IN (SELECT "id" FROM "Property" WHERE "source" <> 'realtor16' OR "source" IS NULL);

-- Now delete from Property
DELETE FROM "Property" WHERE "source" <> 'realtor16' OR "source" IS NULL;

-- Clean up CountyNote records that no longer have corresponding properties
DELETE FROM "CountyNote" WHERE "county" NOT IN (SELECT DISTINCT "county" FROM "Property" WHERE "county" IS NOT NULL);