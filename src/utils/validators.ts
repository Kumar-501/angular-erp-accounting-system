/**
 * Validation utility functions
 */
export class Validators {

    /**
     * Validate email format
     */
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone number format (basic validation)
     */
    static isValidPhone(phone: string): boolean {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    }

    /**
     * Validate URL format
     */
    static isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate if string contains only letters
     */
    static isAlpha(str: string): boolean {
        const alphaRegex = /^[a-zA-Z]+$/;
        return alphaRegex.test(str);
    }

    /**
     * Validate if string contains only letters and numbers
     */
    static isAlphaNumeric(str: string): boolean {
        const alphaNumericRegex = /^[a-zA-Z0-9]+$/;
        return alphaNumericRegex.test(str);
    }

    /**
     * Validate if string is numeric
     */
    static isNumeric(str: string): boolean {
        const numericRegex = /^[0-9]+$/;
        return numericRegex.test(str);
    }

    /**
     * Validate minimum length
     */
    static minLength(str: string, min: number): boolean {
        return str.length >= min;
    }

    /**
     * Validate maximum length
     */
    static maxLength(str: string, max: number): boolean {
        return str.length <= max;
    }

    /**
     * Validate if value is within range
     */
    static isInRange(value: number, min: number, max: number): boolean {
        return value >= min && value <= max;
    }

    /**
     * Validate if date is in the future
     */
    static isFutureDate(date: Date): boolean {
        return date > new Date();
    }

    /**
     * Validate if date is in the past
     */
    static isPastDate(date: Date): boolean {
        return date < new Date();
    }

    /**
     * Validate if value is not empty (null, undefined, empty string, empty array, empty object)
     */
    static isNotEmpty(value: any): boolean {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    }

    /**
     * Validate if two values are equal
     */
    static isEqual(value1: any, value2: any): boolean {
        return JSON.stringify(value1) === JSON.stringify(value2);
    }

    /**
     * Validate file extension
     */
    static hasValidExtension(fileName: string, allowedExtensions: string[]): boolean {
        const extension = fileName.split('.').pop()?.toLowerCase();
        return extension ? allowedExtensions.includes(extension) : false;
    }

    /**
     * Validate file size
     */
    static isValidFileSize(file: File, maxSizeInMB: number): boolean {
        const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        return file.size <= maxSizeInBytes;
    }
}
