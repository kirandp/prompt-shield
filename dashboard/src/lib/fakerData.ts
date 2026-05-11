/**
 * Faker.js Synthetic Data Generator
 * Provides realistic synthetic PHI and PII data for testing and demos
 */

import { faker } from '@faker-js/faker';

/**
 * Generate synthetic patient medical record
 */
export function generateSyntheticPatientRecord(): string {
    const patientName = faker.person.fullName();
    const ssn = `${faker.string.numeric('###')}-${faker.string.numeric('##')}-${faker.string.numeric('####')}`;
    const mrn = 'MR' + faker.string.numeric('######');
    const dob = faker.date.birthdate({ mode: 'age', min: 18, max: 90 }).toISOString().split('T')[0];
    const medications = [
        'aspirin', 'ibuprofen', 'metformin', 'lisinopril', 'atorvastatin',
        'omeprazole', 'albuterol', 'levothyroxine', 'amoxicillin', 'sertraline'
    ];
    const medication = faker.helpers.arrayElement(medications);
    const treatmentDate = faker.date.past().toISOString().split('T')[0];

    return `Patient: ${patientName}
Date of Birth: ${dob}
Social Security Number: ${ssn}
Medical Record Number: ${mrn}
Treatment Date: ${treatmentDate}
Current Medications: ${medication}
Email: ${faker.internet.email()}
Phone: ${faker.phone.number()}`;
}

/**
 * Generate synthetic financial record
 */
export function generateSyntheticFinancialRecord(): string {
    const cardNumber = `${faker.string.numeric('####')}-${faker.string.numeric('####')}-${faker.string.numeric('####')}-${faker.string.numeric('####')}`;
    const cvv = faker.string.numeric('###');
    const accountNumber = faker.string.numeric('##########');
    const routingNumber = faker.string.numeric('#########');
    const amount = faker.finance.amount({ min: 100, max: 50000, dec: 2 });

    return `Account Holder: ${faker.person.fullName()}
Account Number: ${accountNumber}
Routing Number: ${routingNumber}
Card Number: ${cardNumber}
CVV: ${cvv}
Transaction Amount: $${amount}
Email: ${faker.internet.email()}
Phone: ${faker.phone.number()}`;
}

/**
 * Generate synthetic API secret/token
 */
export function generateSyntheticSecret(): string {
    const apiKey = faker.string.alphanumeric(32).toUpperCase();
    const token = faker.string.alphanumeric(64);
    const password = faker.internet.password({ length: 16, memorable: false });

    return `API Key: sk_live_${apiKey}
Auth Token: ${token}
Service: ${faker.company.name()} API
Password: ${password}
Endpoint: https://api.${faker.internet.domainName()}/v1/endpoint`;
}

/**
 * Generate synthetic corporate data
 */
export function generateSyntheticCorporateData(): string {
    const companyName = faker.company.name();
    const employeeName = faker.person.fullName();
    const email = faker.internet.email();
    const phone = faker.phone.number();
    const ipAddress = faker.internet.ipv4();
    const macAddress = faker.internet.mac();
    const internalId = `EMP-${faker.string.numeric('####')}-${faker.string.numeric('####')}`;
    const jobTitle = faker.person.jobTitle();

    return `Company: ${companyName}
Employee: ${employeeName}
Email: ${email}
Phone: ${phone}
Employee ID: ${internalId}
Workstation IP: ${ipAddress}
MAC Address: ${macAddress}
Role: ${jobTitle}`;
}

/**
 * Generate mixed synthetic sensitive data
 */
export function generateSyntheticMixedData(): string {
    const types = [
        generateSyntheticPatientRecord(),
        generateSyntheticFinancialRecord(),
        generateSyntheticCorporateData()
    ];

    return faker.helpers.arrayElement(types);
}

/**
 * Generate all types of synthetic demo data
 */
export const DEMO_INPUTS = {
    PATIENT: generateSyntheticPatientRecord,
    FINANCIAL: generateSyntheticFinancialRecord,
    SECRET: generateSyntheticSecret,
    CORPORATE: generateSyntheticCorporateData,
    MIXED: generateSyntheticMixedData
};

/**
 * Get a random pre-generated demo sample
 */
export function getRandomDemoSample(): string {
    const samples = [
        generateSyntheticPatientRecord(),
        generateSyntheticFinancialRecord(),
        generateSyntheticCorporateData()
    ];
    return faker.helpers.arrayElement(samples);
}

export default {
    generateSyntheticPatientRecord,
    generateSyntheticFinancialRecord,
    generateSyntheticSecret,
    generateSyntheticCorporateData,
    generateSyntheticMixedData,
    getRandomDemoSample,
    DEMO_INPUTS
};

