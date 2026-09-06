/**
 * TradePulse Robust Email & Domain Validator
 * 
 * Validates email syntax, domain structure, TLD validity, and protects against
 * disposable, temporary, malformed, or fake email domains.
 */

const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', '10minutemail.com', 'tempmail.com', 'guerrillamail.com',
    'trashmail.com', 'yopmail.com', 'dispostable.com', 'throwawaymail.com',
    'getnada.com', 'tempmailo.com', 'fakemailgenerator.com', 'maildrop.cc',
    'sharklasers.com', 'crazymailing.com', 'boun.cr', 'armyspy.com',
    'cuvox.de', 'dayrep.com', 'fleckens.hu', 'gustr.com', 'jourrapide.com',
    'rhyta.com', 'superrito.com', 'teleworm.us', 'einrot.com', 'inboxalias.com'
]);

const RESERVED_INVALID_DOMAINS = new Set([
    'example.com', 'example.net', 'example.org', 'invalid', 'test', 'localhost',
    'local', 'domain.invalid', 'test.invalid', 'example.invalid', 'nonexistentdomain.invalid'
]);

/**
 * Validate and normalize email address
 * @param {string} email 
 * @returns {{ isValid: boolean, error?: string, normalizedEmail?: string }}
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { isValid: false, error: 'Email address is required' };
    }

    const trimmed = email.trim().toLowerCase();

    // 1. Basic RFC 5322 Syntax Regex Check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
        return { isValid: false, error: 'Invalid email format' };
    }

    const parts = trimmed.split('@');
    if (parts.length !== 2) {
        return { isValid: false, error: 'Invalid email format' };
    }

    const [localPart, domain] = parts;

    if (localPart.length === 0 || localPart.length > 64) {
        return { isValid: false, error: 'Invalid email username length' };
    }

    if (domain.length === 0 || domain.length > 253) {
        return { isValid: false, error: 'Invalid email domain length' };
    }

    // 2. Check Reserved / Test / Invalid Domains
    if (RESERVED_INVALID_DOMAINS.has(domain) || domain.endsWith('.invalid') || domain.endsWith('.test') || domain.endsWith('.example') || domain.endsWith('.local')) {
        return { isValid: false, error: 'Reserved or test email domains are not allowed' };
    }

    // 3. Check Disposable Email Domains Denylist
    if (DISPOSABLE_DOMAINS.has(domain)) {
        return { isValid: false, error: 'Disposable or temporary email addresses are not allowed' };
    }

    // 4. Optional ALLOWED_EMAIL_DOMAINS Environment Configuration
    const envAllowedDomains = process.env.ALLOWED_EMAIL_DOMAINS;
    if (envAllowedDomains && envAllowedDomains.trim() !== '' && envAllowedDomains.trim() !== '*') {
        const allowedList = envAllowedDomains.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
        const isAllowed = allowedList.some(allowed => {
            if (allowed.startsWith('.')) {
                return domain.endsWith(allowed);
            }
            return domain === allowed;
        });

        if (!isAllowed) {
            return { isValid: false, error: `Registration is restricted to approved domains (${allowedList.join(', ')})` };
        }
    }

    return {
        isValid: true,
        normalizedEmail: trimmed
    };
}

module.exports = {
    validateEmail,
    DISPOSABLE_DOMAINS,
    RESERVED_INVALID_DOMAINS
};
