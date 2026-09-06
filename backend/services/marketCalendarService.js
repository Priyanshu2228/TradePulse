// NSE & BSE Major Trading Holidays list (IST dates)
const NSE_HOLIDAYS_2024_2026 = new Set([
    '2024-01-26', // Republic Day
    '2024-03-08', // Mahashivratri
    '2024-03-25', // Holi
    '2024-03-29', // Good Friday
    '2024-04-11', // Id-Ul-Fitr
    '2024-04-17', // Ram Navami
    '2024-05-01', // Maharashtra Day
    '2024-06-17', // Bakri Id
    '2024-07-17', // Muharram
    '2024-08-15', // Independence Day
    '2024-10-02', // Mahatma Gandhi Jayanti
    '2024-11-01', // Diwali Laxmi Pujan
    '2024-11-15', // Gurunanak Jayanti
    '2024-12-25', // Christmas
    '2025-01-26', '2025-08-15', '2025-10-02', '2025-12-25',
    '2026-01-26', '2026-08-15', '2026-10-02', '2026-12-25'
]);

class MarketCalendarService {
    /**
     * Converts any Date or ISO date string into a normalized Midnight IST Date object.
     * Ensures consistent 00:00:00.000 IST timestamp representation across UTC conversions.
     */
    static normalizeToISTMidnight(dateInput) {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            throw new Error(`Invalid date input: ${dateInput}`);
        }

        // IST is UTC+5:30 (330 minutes)
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(date.getTime() + istOffsetMs);

        const year = istDate.getUTCFullYear();
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(istDate.getUTCDate()).padStart(2, '0');

        // Reconstruct Date object for 00:00:00.000 IST (which corresponds to previous day 18:30:00.000 UTC)
        const normalizedISO = `${year}-${month}-${day}T00:00:00.000+05:30`;
        return new Date(normalizedISO);
    }

    /**
     * Formats Date into IST YYYY-MM-DD string.
     */
    static formatISTDateString(dateInput) {
        const date = new Date(dateInput);
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(date.getTime() + istOffsetMs);
        const year = istDate.getUTCFullYear();
        const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(istDate.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Checks if given date falls on a weekend (Saturday or Sunday) in IST.
     */
    static isWeekend(dateInput) {
        const date = new Date(dateInput);
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(date.getTime() + istOffsetMs);
        const dayOfWeek = istDate.getUTCDay();
        return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
    }

    /**
     * Checks if given date is a listed exchange holiday for NSE/BSE.
     */
    static isHoliday(dateInput, exchange = 'NSE') {
        const dateStr = this.formatISTDateString(dateInput);
        return NSE_HOLIDAYS_2024_2026.has(dateStr);
    }

    /**
     * Checks if given date is a valid trading session day.
     */
    static isTradingDay(dateInput, exchange = 'NSE') {
        return !this.isWeekend(dateInput) && !this.isHoliday(dateInput, exchange);
    }

    /**
     * Checks if given date/time falls within active Indian market hours (09:15 - 15:30 IST) on a valid trading day.
     */
    static isMarketOpen(dateInput = new Date(), exchange = 'NSE') {
        return this.getMarketState(dateInput, exchange) === 'OPEN';
    }

    /**
     * Evaluates current market state: PRE_OPEN | OPEN | CLOSED
     */
    static getMarketState(dateInput = new Date(), exchange = 'NSE') {
        if (!this.isTradingDay(dateInput, exchange)) {
            return 'CLOSED';
        }

        const date = new Date(dateInput);
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(date.getTime() + istOffsetMs);

        const hours = istDate.getUTCHours();
        const minutes = istDate.getUTCMinutes();
        const totalMinutes = hours * 60 + minutes;

        const preOpenMinutes = 9 * 60;     // 09:00 IST
        const openMinutes = 9 * 60 + 15;  // 09:15 IST
        const closeMinutes = 15 * 60 + 30; // 15:30 IST

        if (totalMinutes >= preOpenMinutes && totalMinutes < openMinutes) {
            return 'PRE_OPEN';
        }
        if (totalMinutes >= openMinutes && totalMinutes <= closeMinutes) {
            return 'OPEN';
        }
        return 'CLOSED';
    }
}

module.exports = MarketCalendarService;

