// Domini email aziendali autorizzati alla registrazione
export const ALLOWED_DOMAINS = [
    "ingegno.it",
    "ingegno.org"
];

// Singole email specifiche autorizzate alla registrazione (es. collaboratori o test)
export const ALLOWED_EMAILS = [
    "e.bartalucci@ingegno.it"
];

// Funzione di verifica per controllare se un indirizzo email è autorizzato alla registrazione
export function isEmailAuthorized(email) {
    if (!email) return false;
    const emailLower = email.toLowerCase().trim();
    
    // 1. Verifica se l'email è esplicitamente nella lista delle email ammesse
    if (ALLOWED_EMAILS.includes(emailLower)) {
        return true;
    }
    
    // 2. Verifica se l'email appartiene a uno dei domini aziendali ammessi
    const parts = emailLower.split("@");
    if (parts.length === 2) {
        const domain = parts[1];
        if (ALLOWED_DOMAINS.includes(domain)) {
            return true;
        }
    }
    
    return false;
}
